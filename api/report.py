"""주간 출결 리포트 생성 API
POST /api/report
받는 것: { "data": "출결 요약 텍스트", "tone": "parent" | "student" }
주는 것: { "ok": true, "text": "..." }  또는  { "ok": false, "error": "..." }
"""
import os
import json
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
MODEL = "models/gemini-3-flash-preview"
TIMEOUT = 25

PROMPTS = {
    "parent": """너는 학원 원장을 돕는 주간 리포트 작성 조수다.
주어진 출결 데이터를 3~5문장의 한국어 리포트로 작성한다.
규칙:
- 등급은 이미 정해져 있다. 절대 다시 판단하지 마라.
- 숫자를 지어내지 마라. 주어진 값만 사용한다.
- 학부모에게 보낼 글이므로 정중하고 따뜻한 톤으로 쓴다.
- 질책하지 말고, 개선이 필요하면 격려로 마무리한다.
- 주어진 정보에 없는 이름·사실을 지어내지 마라. 학생 이름은 입력된 값만 그대로 쓴다.
""",

    "student": """너는 학원 학생에게 이번 주 출결을 알려주는 조수다.
주어진 출결 데이터를 3~5문장의 한국어 글로 작성한다.
규칙:
- 등급은 이미 정해져 있다. 절대 다시 판단하지 마라.
- 숫자를 지어내지 마라. 주어진 값만 사용한다.
- 학생 본인이 읽는 글이므로 친근한 말투로 쓴다.
- 잘한 점을 먼저 말하고, 아쉬운 점은 짧게 덧붙인다.
- 주어진 정보에 없는 이름·사실을 지어내지 마라. 학생 이름은 입력된 값만 그대로 쓴다.
""",
}


def extract_text(result):
    """steps 배열에서 model_output 타입의 텍스트만 뽑는다.
    순서가 아니라 type으로 찾는다 (thought 단계가 없을 수도 있음)."""
    text = ""
    for step in result.get("steps", []):
        if step.get("type") == "model_output":
            for c in step.get("content", []):
                if c.get("type") == "text":
                    text += c.get("text", "")
    return text.strip()


class handler(BaseHTTPRequestHandler):

    def _send(self, status, payload):
        """성공/실패 모두 같은 형태의 JSON으로 응답한다."""
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        # ① 요청 본문 읽기
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length))
        except Exception:
            return self._send(400, {"ok": False, "error": "요청 형식이 올바르지 않습니다."})

        data = (payload.get("data") or "").strip()
        tone = payload.get("tone", "parent")

        # ② 필수값 검증 — 여기서 막히면 Gemini를 호출하지 않는다
        if not data:
            return self._send(400, {"ok": False, "error": "출결 데이터가 없습니다."})

        # ③ 환경변수에서 키 읽기 — 코드에 키를 적지 않는 이유
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            print("GEMINI_API_KEY 환경변수가 설정되지 않음")
            return self._send(500, {"ok": False, "error": "서버 설정 오류입니다."})

        # ④ Gemini 호출
        body = json.dumps({
            "model": MODEL,
            "system_instruction": PROMPTS.get(tone, PROMPTS["parent"]),
            "input": data,
            "generation_config": {"thinking_level": "low"},
        }, ensure_ascii=False).encode("utf-8")

        req = urllib.request.Request(
            GEMINI_URL,
            data=body,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
                result = json.loads(res.read())
        except urllib.error.HTTPError as e:
            print("Gemini HTTP 오류:", e.code)
            return self._send(502, {"ok": False, "error": "잠시 후 다시 시도해 주세요."})
        except Exception as e:
            print("Gemini 호출 실패:", type(e).__name__)
            return self._send(504, {"ok": False, "error": "응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."})

        # ⑤ 텍스트 추출
        text = extract_text(result)
        if not text:
            return self._send(502, {"ok": False, "error": "리포트를 생성하지 못했습니다."})

        return self._send(200, {"ok": True, "text": text})