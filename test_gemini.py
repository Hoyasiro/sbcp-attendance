# thinking_level 비교 테스트 (임시 스크립트)
import os, json, time, requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")

URL = "https://generativelanguage.googleapis.com/v1beta/interactions"

# 실제 서비스에서 JS가 계산해 넘겨줄 데이터 (지금은 손으로 작성)
DATA = """
학생: 김민준 (Lv.5)
기간: 2026-08-24 ~ 2026-08-28 (운영 5일)
출석: 4일 / 5일 (80%)
연속 출석: 12일 (신기록 갱신)
체류 시간: 평균 52분 (지난 4주 평균 60분 대비 87%)
등급: 양호
"""

SYSTEM = """너는 학원 원장을 돕는 주간 리포트 작성 조수다.
주어진 출결 데이터를 3~5문장의 한국어 리포트로 작성한다.
규칙:
- 등급은 이미 정해져 있다. 절대 다시 판단하지 마라.
- 숫자를 지어내지 마라. 주어진 값만 사용한다.
- 학부모에게 보낼 글이므로 정중하고 따뜻한 톤으로 쓴다.
- 질책하지 말고, 개선이 필요하면 격려로 마무리한다."""


def call(thinking_level):
    body = {
        "model": "models/gemini-3-flash-preview",
        "system_instruction": SYSTEM,
        "input": DATA,
    }
    if thinking_level:
        body["generation_config"] = {"thinking_level": thinking_level}

    start = time.time()
    res = requests.post(
        URL,
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json=body,
        timeout=60,
    )
    elapsed = time.time() - start
    data = res.json()

    # steps 배열에서 model_output 타입을 찾아 텍스트 추출
    text = ""
    for step in data.get("steps", []):
        if step.get("type") == "model_output":
            for c in step.get("content", []):
                if c.get("type") == "text":
                    text += c.get("text", "")

    usage = data.get("usage", {})
    print(f"\n{'='*50}")
    print(f"thinking_level: {thinking_level or '(지정 안 함)'}")
    print(f"소요 시간: {elapsed:.1f}초")
    print(f"thought 토큰: {usage.get('total_thought_tokens')}")
    print(f"전체 토큰: {usage.get('total_tokens')}")
    print(f"{'-'*50}")
    print(text)


call("low")
call(None)