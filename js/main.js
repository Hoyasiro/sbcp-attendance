// [v1.4 업데이트] 앱 버전 
var APP_VERSION = 'Acad-atd-03_1.4 (Desktop)';
var STORAGE_KEY = 'acad-atd-03_1.4';

var DEF_SETTINGS = { academyName:'삼성영어 셀레나', phone:'' };
var DB = {students:[], attendance:{}, stats:{}, settings: Object.assign({}, DEF_SETTINGS)};

try { 
  // 기존 1.3 버전 키 호환 가능성 열어두기 (1.3 데이터가 있으면 가져옴)
  var _s=localStorage.getItem(STORAGE_KEY) || localStorage.getItem('acad-atd-03_1.3'); 
  if(_s) DB=Object.assign({students:[],attendance:{},stats:{},settings:Object.assign({},DEF_SETTINGS)}, JSON.parse(_s)); 
} catch(e){}
function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); }catch(e){} }

if(!DB.students.length){
  DB.students=[
    {id:1,no:'01',name:'김민준',level:'Lv.5'},
    {id:2,no:'02',name:'이서연',level:'Lv.5'},
    {id:3,no:'03',name:'박지훈',level:'Lv.2'},
  ];
  save();
}

// ===== 날짜/시간 유틸 =====
function today(){ var d=new Date(); return fmtDate(d); }
function fmtDate(d){ return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); }
function nowT(){  var d=new Date(); return p2(d.getHours())+':'+p2(d.getMinutes()); }
function p2(n){ return ('0'+n).slice(-2); }
function curYM(){ var d=new Date(); return d.getFullYear()+'-'+p2(d.getMonth()+1); }
function fmtPhone(el){
  var v=el.value.replace(/\D/g,'');
  if(v.length<=3) el.value=v;
  else if(v.length<=7) el.value=v.slice(0,3)+'-'+v.slice(3);
  else el.value=v.slice(0,3)+'-'+v.slice(3,7)+'-'+v.slice(7,11);
}

// ===== 주말 제외 연속 출결 계산 =====
function prevWeekday(dateStr){
  var d = new Date(dateStr + 'T00:00:00');
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return fmtDate(d);
}
function isWeekend(dateStr){
  var d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

function ensureStat(sid){
  if(!DB.stats[sid]) DB.stats[sid] = {currentStreak:0, longestStreak:0, lastAttendDate:null, monthly:{}, monthlyMinutes:{}};
  if(!DB.stats[sid].monthly) DB.stats[sid].monthly = {};
  if(!DB.stats[sid].monthlyMinutes) DB.stats[sid].monthlyMinutes = {};
  return DB.stats[sid];
}

function recordAttendanceStat(sid, td){
  var st = ensureStat(sid);
  if(st.lastAttendDate === td) return st;

  var ym = td.slice(0,7);
  st.monthly[ym] = (st.monthly[ym]||0) + 1;

  var expectedPrev = prevWeekday(td);
  if(st.lastAttendDate === expectedPrev) st.currentStreak += 1;
  else st.currentStreak = 1;

  if(st.currentStreak > st.longestStreak) st.longestStreak = st.currentStreak;
  st.lastAttendDate = td;
  return st;
}

function addStayMinutes(sid, td, inTime, outTime){
  var st = ensureStat(sid);
  var mins = timeDiffMinutes(inTime, outTime);
  if(mins < 0) mins = 0;
  var ym = td.slice(0,7);
  st.monthlyMinutes[ym] = (st.monthlyMinutes[ym]||0) + mins;
  return mins;
}

function timeDiffMinutes(inTime, outTime){
  if(!inTime || !outTime) return 0;
  var a = inTime.split(':'), b = outTime.split(':');
  var aMin = Number(a[0])*60 + Number(a[1]);
  var bMin = Number(b[0])*60 + Number(b[1]);
  var diff = bMin - aMin;
  return diff < 0 ? 0 : diff;
}

function recalcStatsForStudent(sid){
  var dates = Object.keys(DB.attendance).filter(function(d){ return DB.attendance[d][sid] && DB.attendance[d][sid].inTime; }).sort();
  DB.stats[sid] = {currentStreak:0, longestStreak:0, lastAttendDate:null, monthly:{}, monthlyMinutes:{}};
  var st = DB.stats[sid];
  dates.forEach(function(td){
    var ym = td.slice(0,7);
    st.monthly[ym] = (st.monthly[ym]||0) + 1;
    var expectedPrev = prevWeekday(td);
    if(st.lastAttendDate === expectedPrev) st.currentStreak += 1;
    else st.currentStreak = 1;
    if(st.currentStreak > st.longestStreak) st.longestStreak = st.currentStreak;
    st.lastAttendDate = td;

    var rec = DB.attendance[td][sid];
    if(rec.outTime){
      var mins = timeDiffMinutes(rec.inTime, rec.outTime);
      if(mins > 0) st.monthlyMinutes[ym] = (st.monthlyMinutes[ym]||0) + mins;
    }
  });
}

function liveStreak(sid){
  var st = DB.stats[sid];
  if(!st || !st.lastAttendDate) return 0;
  var td = today();
  if(st.lastAttendDate === td) return st.currentStreak;
  var checkDate = isWeekend(td) ? td : td;
  var expectedPrev = prevWeekday(checkDate);
  if(st.lastAttendDate >= expectedPrev) return st.currentStreak;
  return 0;
}

// ===== 랭킹 계산 =====
function getMonthlyRanking(){
  var ym = curYM();
  return DB.students.map(function(s){
    var st = DB.stats[s.id];
    var cnt = (st && st.monthly[ym]) || 0;
    return {s:s, value:cnt};
  }).sort(function(a,b){ return b.value - a.value; });
}
function getStreakRanking(){
  return DB.students.map(function(s){
    return {s:s, value: liveStreak(s.id), best: (DB.stats[s.id]&&DB.stats[s.id].longestStreak)||0};
  }).sort(function(a,b){ return b.value - a.value || b.best - a.best; });
}
function getMinutesRanking(){
  var ym = curYM();
  return DB.students.map(function(s){
    var st = DB.stats[s.id];
    var minutes = (st && st.monthlyMinutes && st.monthlyMinutes[ym]) || 0;
    return {s:s, value:minutes};
  }).sort(function(a,b){ return b.value - a.value; });
}
function medalEmoji(i){
  if(i===0) return '🥇'; if(i===1) return '🥈'; if(i===2) return '🥉'; return (i+1);
}

// ===== 탭 이동 (사이드바) =====
function goTab(n){
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('.side-item').forEach(function(t){t.classList.remove('active');});
  document.getElementById('screen-'+n).classList.add('active');
  document.getElementById('tab-'+n).classList.add('active');
  
  if(n==='home'){
    renderRecent(); renderRank3Group();
    setTimeout(function(){document.getElementById('numInput').focus();},100);
  }
  if(n==='students') renderStudents();
  if(n==='settings') loadSettings();
}

// ===== 출결 입력 처리 =====
function showResult(type, title, sub){
  var box=document.getElementById('resultBox');
  box.className='result-box show '+type;
  var icons={success:'✅', checkout:'🏠', error:'❌'};
  document.getElementById('resultIcon').textContent=icons[type]||'ℹ️';
  document.getElementById('resultText').textContent=title;
  document.getElementById('resultSub').textContent=sub||'';
  clearTimeout(box._t);
  box._t=setTimeout(function(){box.classList.remove('show');},3000);
}

document.addEventListener('DOMContentLoaded', function(){
  var d=new Date();
  document.getElementById('dateChip').textContent = d.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'});
  document.getElementById('rankMonthLabel').textContent = (d.getMonth()+1)+'월 기준';

  var input=document.getElementById('numInput');
  input.addEventListener('input', function(){
    this.value=this.value.replace(/\D/g,'').slice(0,2);
    if(this.value.length===2) setTimeout(function(){processAttend(input.value);},150);
  });
  input.addEventListener('keydown', function(e){
    if(e.key==='Enter' && this.value.length>0) processAttend(this.value.padStart(2,'0'));
  });
  
  // 최초 로드 시 포커스
  renderRecent();
  renderRank3Group();
  setTimeout(function(){input.focus();}, 100);
  
  // 화면 클릭 시 항상 입력창 포커스 복귀 (홈 화면일때만)
  document.addEventListener('click', function(e){
    var homeScreen = document.getElementById('screen-home');
    if(homeScreen && homeScreen.classList.contains('active') && e.target.tagName !== 'BUTTON' && !e.target.closest('.mov')) {
      input.focus();
    }
  });
});

function processAttend(no){
  var input=document.getElementById('numInput');
  var padded=no.padStart(2,'0');
  var s=DB.students.find(function(x){return x.no===padded;});

  if(!s){
    showResult('error','등록번호 '+padded+' 없음','등록되지 않은 번호입니다.');
    input.value=''; input.focus(); return;
  }

  var td=today();
  if(!DB.attendance[td]) DB.attendance[td]={};
  var rec=DB.attendance[td][s.id];

  var isOut = rec && rec.inTime && !rec.outTime;
  var time=nowT();
  var type, title, sub;
  var isNewBest = false;
  var undoAction = null;

  if(!rec){
    DB.attendance[td][s.id]={inTime:time, outTime:null};
    var prevBest = ensureStat(s.id).longestStreak;
    var st = recordAttendanceStat(s.id, td);
    isNewBest = st.currentStreak > prevBest && st.currentStreak > 1;
    type  = 'success'; title = s.name+' 등원 처리됨';
    sub = '🔥 연속 '+st.currentStreak+'일 출석 중' + (isNewBest ? ' (신기록!)' : '');
    undoAction = function(){ cancelAttend(s.id, 'all', true); };
  } else if(isOut){
    DB.attendance[td][s.id].outTime=time;
    var stayMin = addStayMinutes(s.id, td, rec.inTime, time);
    type  = 'checkout'; title = s.name+' 하원 처리됨'; sub = '오늘 학습 시간: '+stayMin+'분';
    undoAction = function(){ cancelAttend(s.id, 'outTime', true); };
  } else {
    showResult('error', s.name+' 학생', '오늘 등/하원이 모두 완료되었습니다.');
    input.value=''; input.focus(); return;
  }

  save();
  showResult(type, title, sub);
  renderRecent();
  renderRank3Group();
  showUndoToast(s.name+' 학생 '+(isOut?'하원':'등원')+' 완료', undoAction);

  if(!isOut) openRecordPopup(s.id, isNewBest);

  input.value='';
  setTimeout(function(){input.focus();},100);
}

// ===== 기록 팝업 =====
function openRecordPopup(sid, isNewBest){
  var s = DB.students.find(function(x){return x.id===sid;});
  if(!s) return;
  var st = ensureStat(sid);
  var ym = curYM();
  
  var monthRank = getMonthlyRanking().findIndex(function(r){return r.s.id===sid;}) + 1;
  var streakRank = getStreakRanking().findIndex(function(r){return r.s.id===sid;}) + 1;
  var streak = liveStreak(sid);

  document.getElementById('recEmoji').textContent = isNewBest ? '🏆' : (streak>=5 ? '🔥' : '🎉');
  document.getElementById('recName').textContent = s.name+' 학생';
  document.getElementById('recStatus').textContent = (s.level?('Lv: '+s.level):'') + ' · 등록번호 '+s.no;
  document.getElementById('recMonthCount').textContent = st.monthly[ym] || 0;
  document.getElementById('recStreak').innerHTML = streak + (isNewBest?'<span class="record-new">신기록</span>':'');
  document.getElementById('recBest').textContent = st.longestStreak;
  document.getElementById('recMinutes').textContent = st.monthlyMinutes[ym] || 0;
  document.getElementById('recMonthRank').textContent = monthRank ? (monthRank+'위 / '+DB.students.length+'명') : '-';
  document.getElementById('recStreakRank').textContent = streakRank ? (streakRank+'위 / '+DB.students.length+'명') : '-';

  document.getElementById('recordMov').classList.add('show');
}

// ===== 출결 취소 =====
function cancelAttend(sid, field, silent){
  if(!silent && !confirm('해당 기록을 취소하시겠습니까?')) return;
  var td=today();
  if(!DB.attendance[td] || !DB.attendance[td][sid]) return;
  if(field==='all'){
    delete DB.attendance[td][sid];
    recalcStatsForStudent(sid);
  } else if(field==='outTime'){
    var rec = DB.attendance[td][sid];
    if(rec.outTime && rec.inTime){
      var st = ensureStat(sid);
      var ym = td.slice(0,7);
      var mins = timeDiffMinutes(rec.inTime, rec.outTime);
      if(mins > 0) st.monthlyMinutes[ym] = Math.max(0, (st.monthlyMinutes[ym]||0) - mins);
    }
    rec.outTime=null;
  }
  save(); renderRecent(); renderRank3Group();
  hideUndoToast();
  if(!silent) showToast('✅ 출결 기록이 정상적으로 취소되었습니다.');
}

// ===== UI 렌더링 =====
function renderRecent(){
  var td=today(), att=DB.attendance[td]||{};
  var keys=Object.keys(att);
  var inCnt=0, outCnt=0;
  keys.forEach(function(k){ var r=att[k]; if(r.inTime) inCnt++; if(r.outTime) outCnt++; });

  document.getElementById('statPills').innerHTML=
    '<span class="spill spill-in">🟢 등원 '+inCnt+'명</span>'+
    '<span class="spill spill-out">🟠 하원 '+outCnt+'명</span>'+
    '<span class="spill spill-total">전체 '+DB.students.length+'명</span>';

  var list=document.getElementById('recentList');
  if(!keys.length){
    list.innerHTML='<div class="empty-recent">아직 출석한 학생이 없습니다</div>';
    return;
  }

  var items=keys.map(function(k){
    var s=DB.students.find(function(x){return x.id==k;});
    return {s:s, r:att[k], sid:k};
  }).filter(function(x){return x.s;});
  items.sort(function(a,b){
    var ta=a.r.outTime||a.r.inTime||'';
    var tb=b.r.outTime||b.r.inTime||'';
    return tb.localeCompare(ta);
  });

  list.innerHTML=items.map(function(x){
    var s=x.s, r=x.r, sid=x.sid;
    var hasOut=!!r.outTime;
    var numCls=hasOut?'num-out':'num-in';
    var timeCls=hasOut?'time-out':'time-in';
    var badge=hasOut?'<span class="status-badge badge-out">하원</span>':'<span class="status-badge badge-in">등원</span>';
    var timeStr=hasOut?(r.inTime+' → '+r.outTime):r.inTime;
    var cancelField=hasOut?'outTime':'all';

    return '<div class="recent-item">'
      +'<div class="recent-num '+numCls+'">'+s.no+'</div>'
      +'<div class="recent-info"><div class="recent-name">'+s.name+'</div>'
      +'<div class="recent-cls">'+(s.level?('Lv: '+s.level):'')+'</div></div>'
      +'<div class="recent-right"><span class="recent-time '+timeCls+'">'+timeStr+'</span>'+badge+'</div>'
      +'<button class="cancel-btn" onclick="cancelAttend('+sid+',\''+cancelField+'\')" title="기록 취소">✕</button>'
      +'</div>';
  }).join('');
}

var RANK3_DEFS = [
  { key:'month',   icon:'📅', title:'월간 출결일수',   unit:'일',  getter:getMonthlyRanking },
  { key:'streak',  icon:'🔥', title:'최장 연속출결',    unit:'일째', getter:getStreakRanking  },
  { key:'minutes', icon:'⏱️', title:'당월 체류시간',     unit:'분',  getter:getMinutesRanking }
];

function buildTop3Rows(def){
  var data = def.getter().filter(function(r){ return r.value > 0; }).slice(0, 3);
  if(!data.length) return '<div class="rank3-empty">아직 랭킹 기록이 없습니다</div>';
  return data.map(function(r, i){
    return '<div class="rank3-row">'
      +'<span class="rank3-medal '+(i===0?'r1':i===1?'r2':i===2?'r3':'')+'">'+medalEmoji(i)+'</span>'
      +'<span class="rank3-name">'+r.s.name+'</span>'
      +'<span class="rank3-val">'+r.value+def.unit+'</span>'
      +'</div>';
  }).join('');
}

function renderRank3Group(){
  var wrap = document.getElementById('rank3Group');
  if(!wrap) return;
  wrap.innerHTML = RANK3_DEFS.map(function(def){
    return '<div class="rank3-card">'
      +'<div class="rank3-card-head"><span class="rank3-card-icon">'+def.icon+'</span><span class="rank3-card-title">'+def.title+'</span></div>'
      +buildTop3Rows(def)
      +'</div>';
  }).join('');
}

// ===== 학생 관리 =====
function renderStudents(){
  var list=document.getElementById('stuList');
  document.getElementById('stuCount').textContent=DB.students.length+'명';
  if(!DB.students.length){list.innerHTML='<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text2);">등록된 학생이 없습니다.</div>';return;}
  var sorted=[].concat(DB.students).sort(function(a,b){return a.no.localeCompare(b.no);});
  list.innerHTML=sorted.map(function(s){
    var st = DB.stats[s.id];
    var monthCount = (st && st.monthly[curYM()]) || 0;
    return '<div class="stu-row">'
      +'<div class="stu-badge">'+s.no+'</div>'
      +'<div class="stu-info"><div class="stu-name">'+s.name+'</div>'
      +'<div class="stu-meta">'+(s.level?('Lv: '+s.level):'레벨 미지정')+' · 당월 '+monthCount+'일 출석 · 🔥'+liveStreak(s.id)+'일</div></div>'
      +'<div class="stu-actions">'
      +'<button class="stu-edit" onclick="openEdit('+s.id+')">✏️</button>'
      +'<button class="stu-del"  onclick="delStu('+s.id+')">✕</button>'
      +'</div></div>';
  }).join('');
}

function openAdd(){
  ['mNo','mName','mLevel'].forEach(function(i){document.getElementById(i).value='';});
  document.getElementById('addMov').classList.add('show');
}
function closeMov(id){document.getElementById(id).classList.remove('show');}

function addStu(){
  var no=document.getElementById('mNo').value.trim().padStart(2,'0');
  var name=document.getElementById('mName').value.trim();
  var level=document.getElementById('mLevel').value.trim();
  if(!no||!name){showToast('등록번호, 이름은 필수입니다.');return;}
  if(DB.students.find(function(s){return s.no===no;})){showToast('이미 사용 중인 번호입니다.');return;}
  DB.students.push({id:Date.now(),no:no,name:name,level:level});
  save();closeMov('addMov');renderStudents();showToast('✅ '+name+' 학생이 등록되었습니다.');
}
function openEdit(id){
  var s=DB.students.find(function(x){return x.id===id;});if(!s)return;
  document.getElementById('eId').value=s.id;
  document.getElementById('eNo').value=s.no;
  document.getElementById('eName').value=s.name;
  document.getElementById('eLevel').value=s.level||'';
  document.getElementById('editMov').classList.add('show');
}
function saveEdit(){
  var id=Number(document.getElementById('eId').value);
  var no=document.getElementById('eNo').value.trim().padStart(2,'0');
  var name=document.getElementById('eName').value.trim();
  var level=document.getElementById('eLevel').value.trim();
  if(!no||!name){showToast('등록번호, 이름은 필수입니다.');return;}
  if(DB.students.find(function(s){return s.no===no&&s.id!==id;})){showToast('이미 사용 중인 번호입니다.');return;}
  var s=DB.students.find(function(x){return x.id===id;});if(!s)return;
  s.no=no;s.name=name;s.level=level;
  save();closeMov('editMov');renderStudents();showToast('✅ 정보가 수정되었습니다.');
}
function delStu(id){
  if(!confirm('삭제하시겠습니까? 출결 및 랭킹 기록도 모두 삭제됩니다.'))return;
  DB.students=DB.students.filter(function(s){return s.id!==id;});
  delete DB.stats[id];
  Object.keys(DB.attendance).forEach(function(d){ delete DB.attendance[d][id]; });
  save();renderStudents();renderRank3Group();
}

// ===== 데이터 관리 (CSV 다운로드) =====
function csvDL(filename, rows){
  var csv=rows.map(function(r){
    return r.map(function(c){
      var v=c==null?'':String(c);
      if(v.indexOf(',')>-1||v.indexOf('"')>-1||v.indexOf('\n')>-1) v='"'+v.replace(/"/g,'""')+'"';
      return v;
    }).join(',');
  }).join('\n');
  var blob=new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function dlAttendance(){
  var ym=curYM();
  var rows=[['날짜','등록번호','이름','레벨','등원시간','하원시간']];
  var dates=Object.keys(DB.attendance).filter(function(d){return d.startsWith(ym);}).sort();
  dates.forEach(function(dt){
    var att=DB.attendance[dt];
    Object.keys(att).forEach(function(sid){
      var s=DB.students.find(function(x){return x.id==sid;});
      rows.push([dt, s?s.no:'', s?s.name:'(삭제됨)', s?s.level:'', att[sid].inTime||'', att[sid].outTime||'']);
    });
  });
  if(rows.length===1){showToast('이번 달 출결 기록이 없습니다.');return;}
  csvDL('출결기록_'+ym+'.csv', rows); showToast('📥 출결기록 다운로드 완료');
}

function dlStudents(){
  var rows=[['등록번호','이름','레벨']];
  var sorted=[].concat(DB.students).sort(function(a,b){return a.no.localeCompare(b.no);});
  sorted.forEach(function(s){ rows.push([s.no, s.name, s.level||'']); });
  if(rows.length===1){showToast('등록된 학생이 없습니다.');return;}
  csvDL('학생명단.csv', rows); showToast('📥 학생명단 다운로드 완료');
}

function dlRanking(){
  var ym=curYM();
  var rows=[['등록번호','이름','레벨','이번달 출결일수','이번달 체류시간(분)','현재 연속출석(주말제외)','최장 연속기록']];
  var sorted=[].concat(DB.students).sort(function(a,b){return a.no.localeCompare(b.no);});
  sorted.forEach(function(s){
    var st=DB.stats[s.id];
    var monthCount=(st&&st.monthly[ym])||0;
    var monthMinutes=(st&&st.monthlyMinutes&&st.monthlyMinutes[ym])||0;
    rows.push([s.no, s.name, s.level||'', monthCount, monthMinutes, liveStreak(s.id), (st&&st.longestStreak)||0]);
  });
  if(rows.length===1){showToast('데이터가 없습니다.');return;}
  csvDL('출결랭킹_'+ym+'.csv', rows); showToast('📥 출결랭킹 다운로드 완료');
}

// ===== 데이터 관리 (JSON 백업 / 복구) =====
function exportBackup() {
  var dataStr = JSON.stringify(DB);
  var blob = new Blob([dataStr], {type: "application/json;charset=utf-8;"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = "acad_backup.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('💾 데이터 백업 파일이 다운로드되었습니다.');
}

function importBackup(event) {
  var file = event.target.files[0];
  if(!file) return;
  
  if(!confirm("경고: 기존 출결 및 학생 데이터가 모두 삭제되고, 업로드한 파일의 데이터로 덮어쓰기 됩니다. 진행하시겠습니까?")) {
    event.target.value = ''; // 초기화
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var newDB = JSON.parse(e.target.result);
      if(newDB && newDB.students && newDB.attendance) {
        DB = newDB;
        save();
        alert('✅ 데이터 복구가 성공적으로 완료되었습니다.\n새로고침을 진행합니다.');
        location.reload();
      } else {
        alert('❌ 올바르지 않은 백업 파일 형식입니다.');
      }
    } catch(err) {
      alert('❌ 파일 읽기 오류가 발생했습니다.');
    }
  };
  reader.readAsText(file);
}

// ===== 설정 =====
function loadSettings(){
  var s=DB.settings;
  document.getElementById('cfgName').value=s.academyName||'';
  document.getElementById('cfgPhone').value=s.phone||'';
  var vText = document.getElementById('appVersionText');
  if(vText) vText.textContent = APP_VERSION;
}
function saveSettings(){
  DB.settings.academyName=document.getElementById('cfgName').value.trim()||'학원';
  DB.settings.phone=document.getElementById('cfgPhone').value.trim();
  save();showToast('✅ 설정이 저장되었습니다.');
}

// ===== 토스트 & Undo =====
var _tt;
function showToast(m){
  var el=document.getElementById('toast');
  el.textContent=m; el.classList.add('show');
  clearTimeout(_tt); _tt=setTimeout(function(){el.classList.remove('show');},3000);
}

var UNDO_WINDOW_MS = 6000;
var _undoTimer = null, _pendingUndoAction = null;

function showUndoToast(message, undoAction){
  _pendingUndoAction = undoAction;
  var el = document.getElementById('undoToast');
  var bar = document.getElementById('undoTimerBar');
  document.getElementById('undoText').innerHTML = '<b>'+message+'</b><br>잘못 입력했다면 지금 취소할 수 있습니다.';

  clearTimeout(_undoTimer);
  el.classList.add('show');

  bar.style.transition = 'none'; bar.style.width = '100%';
  requestAnimationFrame(function(){
    bar.style.transition = 'width '+UNDO_WINDOW_MS+'ms linear';
    bar.style.width = '0%';
  });

  _undoTimer = setTimeout(function(){ hideUndoToast(); }, UNDO_WINDOW_MS);
}
function hideUndoToast(){
  clearTimeout(_undoTimer);
  document.getElementById('undoToast').classList.remove('show');
  _pendingUndoAction = null;
}
function triggerUndo(){
  if(typeof _pendingUndoAction === 'function'){
    _pendingUndoAction();
  }
  hideUndoToast();
}
