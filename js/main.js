// [v1.4 업데이트] 앱 버전 
var APP_VERSION = 'Acad-atd-03_1.4 (Desktop)';
var STORAGE_KEY = 'acad-atd-03_1.4';

var DEF_SETTINGS = { academyName:'삼성영어 셀레나', phone:'' };
var DB = {students:[], attendance:{}, stats:{}, holidays:[], settings: Object.assign({}, DEF_SETTINGS)};

try { 
  // 기존 1.3 버전 키 호환 가능성 열어두기 (1.3 데이터가 있으면 가져옴)
  var _s=localStorage.getItem(STORAGE_KEY) || localStorage.getItem('acad-atd-03_1.3'); 
  if(_s) DB=Object.assign({students:[],attendance:{},stats:{},holidays:[],settings:Object.assign({},DEF_SETTINGS)}, JSON.parse(_s)); 
} catch(e){}
if(!DB.holidays) DB.holidays = [];   // 기존 저장 데이터에는 holidays가 없으므로 보정
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
  if(n==='report') fillStudentSelect();
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
  renderHolidays();
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

// ===== 대한민국 양력 공휴일 =====
// 매년 날짜가 고정된 공휴일만 자동 생성한다.
// 설날·추석·부처님오신날은 음력이라 계산이 복잡하고,
// 대체공휴일·임시공휴일은 정부 발표 전에는 알 수 없으므로
// 원장이 직접 추가하도록 한다.

var FIXED_HOLIDAYS = [
  {md:'01-01', name:'신정'},
  {md:'03-01', name:'삼일절'},
  {md:'05-05', name:'어린이날'},
  {md:'06-06', name:'현충일'},
  {md:'08-15', name:'광복절'},
  {md:'10-03', name:'개천절'},
  {md:'10-09', name:'한글날'},
  {md:'12-25', name:'성탄절'}
];

function addFixedHolidays(){
  var year = new Date().getFullYear();
  var added = 0;
  FIXED_HOLIDAYS.forEach(function(h){
    var d = year + '-' + h.md;
    if(!isHoliday(d)){
      DB.holidays.push(d);
      added++;
    }
  });
  save();
  renderHolidays();
  if(added > 0) showToast('✅ ' + year + '년 공휴일 ' + added + '일이 추가되었습니다.');
  else showToast('이미 모두 등록되어 있습니다.');
}

// ===== 휴원일 관리 =====
// 휴원일은 출석률 계산의 분모에서 제외된다.
// 주말은 isWeekend()로 판별하고, 공휴일·자체휴강은 원장이 직접 등록한다.

function isHoliday(dateStr){
  return DB.holidays.indexOf(dateStr) > -1;
}

function renderHolidays(){
  var box = document.getElementById('holidayList');
  if(!box) return;
  if(!DB.holidays.length){
    box.innerHTML = '<div class="holiday-empty">등록된 휴원일이 없습니다.</div>';
    return;
  }
  var sorted = [].concat(DB.holidays).sort();
  box.innerHTML = sorted.map(function(d){
    return '<span class="holiday-chip">' + d
      + '<button data-date="' + d + '">✕</button></span>';
  }).join('');
}

function addHoliday(){
  var input = document.getElementById('holidayInput');
  var d = input.value;
  if(!d){ showToast('날짜를 선택해 주세요.'); return; }
  if(isHoliday(d)){ showToast('이미 등록된 날짜입니다.'); return; }
  DB.holidays.push(d);
  save();
  renderHolidays();
  input.value = '';
  showToast('✅ ' + d + ' 휴원일로 등록되었습니다.');
}

function removeHoliday(dateStr){
  DB.holidays = DB.holidays.filter(function(d){ return d !== dateStr; });
  save();
  renderHolidays();
  showToast('휴원일에서 제외되었습니다.');
}

// 이벤트 연결 (인라인 onclick 대신 addEventListener 사용)
document.addEventListener('DOMContentLoaded', function(){
  var addBtn = document.getElementById('holidayAddBtn');
  if(addBtn) addBtn.addEventListener('click', addHoliday);

  var fixedBtn = document.getElementById('holidayFixedBtn');
  if(fixedBtn) fixedBtn.addEventListener('click', addFixedHolidays);

  // 삭제 버튼은 목록이 다시 그려질 때마다 새로 생기므로
  // 부모 요소에 한 번만 걸고 클릭 대상을 확인하는 방식으로 처리한다
  var list = document.getElementById('holidayList');
  if(list){
    list.addEventListener('click', function(e){
      var d = e.target.getAttribute('data-date');
      if(d) removeHoliday(d);
    });
  }
});

// ===== 주간 출결 집계 =====
// S1 판정 기준 정의서(A~F)를 코드로 옮긴 부분.
// 여기서 계산한 결과를 AI에게 재료로 넘긴다. 판정은 AI가 하지 않는다.

// 기준일이 속한 주의 월요일을 구한다
function weekStart(baseDate){
  var d = new Date((baseDate || today()) + 'T00:00:00');
  var day = d.getDay();              // 0=일 1=월 ... 6=토
  var diff = (day === 0) ? -6 : 1 - day;   // 일요일이면 지난 월요일로
  d.setDate(d.getDate() + diff);
  return fmtDate(d);
}

// 월~금 중 실제 운영하는 날짜만 배열로 반환 (주말·휴원일 제외)
function weekDays(monday){
  var days = [];
  var d = new Date(monday + 'T00:00:00');
  for(var i = 0; i < 5; i++){
    var ds = fmtDate(d);
    if(!isWeekend(ds) && !isHoliday(ds)) days.push(ds);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// 출석률로 등급을 판정한다 (S1 정의서 B·E)
function gradeOf(rate){
  if(rate >= 100) return '최고';
  if(rate >= 80)  return '양호';
  if(rate >= 60)  return '보통';
  return '주의';
}

// 한 학생의 주간 출결을 집계한다
function weeklyStats(sid, baseDate){
  var monday = weekStart(baseDate);
  var days = weekDays(monday);
  var s = DB.students.find(function(x){ return x.id === sid; });

  var present = 0;      // 출석 일수
  var minutes = [];     // 날짜별 체류 시간(분)
  var noCheckout = 0;   // 하원 미체크 횟수

  days.forEach(function(d){
    var rec = DB.attendance[d] && DB.attendance[d][sid];
    if(rec && rec.inTime){
      present++;
      if(rec.outTime){
        minutes.push(timeDiffMinutes(rec.inTime, rec.outTime));
      } else {
        minutes.push(0);   // 하원 미체크는 0분 (S1 결정 D-4)
        noCheckout++;
      }
    }
  });

  var total = days.length;
  var rate = total ? Math.round(present / total * 100) : 0;
  var avgMin = minutes.length
    ? Math.round(minutes.reduce(function(a,b){ return a+b; }, 0) / minutes.length)
    : 0;

  var st = DB.stats[sid] || {};

  return {
    student: s,
    monday: monday,
    lastDay: days.length ? days[days.length-1] : monday,
    totalDays: total,      // 운영일 (분모)
    present: present,      // 출석일
    rate: rate,            // 출석률 %
    grade: gradeOf(rate),  // 등급
    streak: liveStreak(sid),
    bestStreak: st.longestStreak || 0,
    avgMinutes: avgMin,
    noCheckout: noCheckout
  };
}

// ===== 주간 리포트 화면 =====
// 지침 9-2에 따라 역할을 나눈다.
//   collectReportInput  입력 수집·검증
//   renderReportStats   집계 결과 렌더링
//   (다음 단계에서 API 호출 함수 추가)

var reportTone = 'parent';   // 현재 선택된 톤

// ===== 리포트 캐시 (2단 구조) =====
// 같은 학생·같은 집계값·같은 톤이면 AI에게 물어볼 내용이 똑같다.
// 이미 받아 둔 문장을 재사용해 불필요한 API 호출을 막는다 (제약 C5).
//
//   1단 메모리       — 가장 빠름. 새로고침하면 사라짐
//   2단 localStorage — 브라우저를 껐다 켜도 남음
//
// 앱 시작 시 2단을 1단으로 올려 두므로, 조회할 때는 메모리만 보면 된다.

var REPORT_CACHE_KEY = 'acad-report-cache';   // localStorage에 쓰는 이름
var reportCache = {};                          // 1단 (메모리)

// 캐시를 찾을 때 쓰는 열쇠를 만든다.
// 집계값이 하나라도 바뀌면 열쇠가 달라져 새로 호출된다.
function reportCacheKey(st, tone){
  return [
    st.student.id, st.monday, st.present, st.totalDays,
    st.streak, st.avgMinutes, st.grade, tone
  ].join('|');
}

// 2단에서 꺼내온다. 저장된 것이 없거나 형식이 깨졌으면 빈 객체를 준다.
function loadReportCache(){
  try {
    var raw = localStorage.getItem(REPORT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e){
    return {};   // 실패해도 서비스는 계속 돌아가야 한다. 캐시는 있으면 좋은 것일 뿐
  }
}

// 양쪽에 저장한다.
// 집계값이 바뀌면 이전 리포트는 더 이상 쓸모가 없으므로,
// 같은 학생·같은 톤의 헌 항목은 지우고 최신 1개만 남긴다.
function saveReportCache(key, text){
  // 열쇠는 "학생ID|월요일|출석|운영일|연속|평균체류|등급|톤" 형태다.
  // 맨 앞의 학생ID와 맨 뒤의 톤이 같으면 같은 조합으로 본다.
  var parts = key.split('|');
  var sid   = parts[0];
  var tone  = parts[parts.length - 1];
  var isSameCombo = function(k){
    var p = k.split('|');
    return p[0] === sid && p[p.length - 1] === tone;
  };

  // 1단 — 헌 항목을 지우고 새것을 넣는다
  Object.keys(reportCache).forEach(function(k){
    if(isSameCombo(k)) delete reportCache[k];
  });
  reportCache[key] = text;

  // 2단 — 같은 방식으로 정리 후 저장
  try {
    var stored = loadReportCache();
    Object.keys(stored).forEach(function(k){
      if(isSameCombo(k)) delete stored[k];
    });
    stored[key] = text;
    localStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(stored));
  } catch(e){
    // 용량 초과 등으로 실패해도 무시한다. 1단 메모리는 이미 저장됐다
    console.warn('리포트 캐시 저장 실패:', e);
  }
}

// 앱이 켜질 때 2단 내용을 1단으로 미리 올려 둔다
reportCache = loadReportCache();

// 리포트 화면 진입 시 입력칸 초기화
function fillStudentSelect(){
  var input = document.getElementById('reportCode');
  if(!input) return;
  input.value = '';
  updateReportName();
  refreshReportStats();   // 탭에 다시 들어왔을 때 이전 학생의 카드·리포트를 지운다
  setTimeout(function(){ input.focus(); }, 100);
}

// 입력된 번호로 학생을 찾는다 (없으면 null)
function findStudentByCode(){
  var input = document.getElementById('reportCode');
  var no = (input.value || '').trim();
  if(no.length !== 2) return null;
  return DB.students.find(function(s){ return s.no === no; }) || null;
}

// 입력에 따라 학생 이름을 실시간 표시
function updateReportName(){
  var el = document.getElementById('reportName');
  var input = document.getElementById('reportCode');
  var no = (input.value || '').trim();

  if(!no){
    el.textContent = '번호를 입력하세요';
    el.className = 'rc-name';
    return;
  }
  var s = findStudentByCode();
  if(s){
    el.textContent = s.name + (s.level ? ' (' + s.level + ')' : '');
    el.className = 'rc-name found';
  } else if(no.length === 2){
    el.textContent = '등록되지 않은 번호입니다';
    el.className = 'rc-name notfound';
  } else {
    el.textContent = '두 자리를 입력하세요';
    el.className = 'rc-name';
  }
}

// 입력 수집 + 검증 (S1 정의서 F-5)
function collectReportInput(){
  var input = document.getElementById('reportCode');
  var no = (input.value || '').trim();

  if(!no){
    showReportMessage('error', '학생 번호를 입력해 주세요.');
    return null;
  }
  var s = findStudentByCode();
  if(!s){
    showReportMessage('error', '등록되지 않은 번호입니다. 다시 한 번 확인해주세요.');
    return null;
  }
  return { sid: s.id, tone: reportTone };
}

// 집계 결과를 카드로 표시
function renderReportStats(st){
  var box = document.getElementById('reportStats');
  var period = st.monday + ' ~ ' + st.lastDay;

  box.innerHTML =
      '<div class="rs-card"><div class="rs-num">' + st.present + ' / ' + st.totalDays + '</div>'
    + '<div class="rs-label">출석 / 운영일</div></div>'
    + '<div class="rs-card"><div class="rs-num">' + st.rate + '%</div>'
    + '<div class="rs-label">출석률</div></div>'
    + '<div class="rs-card"><div class="rs-num">' + st.streak + '</div>'
    + '<div class="rs-label">연속 출석(일)</div></div>'
    + '<div class="rs-card"><div class="rs-num">' + st.avgMinutes + '</div>'
    + '<div class="rs-label">평균 체류(분)</div></div>'
    + '<div class="rs-grade grade-' + st.grade + '">'
    + '판정: ' + st.grade + ' <span style="font-weight:400;font-size:13px;">(' + period + ')</span>'
    + '</div>';
}

// 입력된 번호에 맞춰 카드를 다시 그린다.
// 규칙: 카드는 항상 "지금 입력창에 있는 번호"의 것이어야 한다.
// 유효하지 않은 번호면 카드도 리포트도 남기지 않는다.
function refreshReportStats(){
  var statsBox = document.getElementById('reportStats');
  var outBox   = document.getElementById('reportOutput');
  var btn      = document.getElementById('reportBtn');
  if(!statsBox || !outBox) return;

  // 번호가 바뀌는 순간 이전 학생의 결과는 무조건 지운다
  statsBox.innerHTML = '';
  outBox.innerHTML   = '';

  var s = findStudentByCode();
  if(!s){
    // 유효한 번호가 아니면 생성 버튼도 숨긴다.
    // 누를 수 없는 버튼을 보여 주는 것보다 안 보이는 편이 덜 헷갈린다.
    if(btn) btn.style.display = 'none';
    return;
  }

  if(btn) btn.style.display = '';   // 기본값으로 되돌려 다시 보이게 한다
  renderReportStats(weeklyStats(s.id));
}

// 출력 영역에 안내 메시지 표시
function showReportMessage(type, text){
  var box = document.getElementById('reportOutput');
  box.innerHTML = '<div class="ro-msg ' + type + '">' + text + '</div>';
}

// 집계 결과를 AI에게 넘길 텍스트로 변환한다.
// 판정(등급)은 이미 끝난 상태로 넘긴다. AI는 문장만 쓴다.
function buildReportData(st){
  var lines = [
    '학생 이름: ' + st.student.name,
    '레벨: ' + (st.student.level || '미지정'),
    '기간: ' + st.monday + ' ~ ' + st.lastDay + ' (운영 ' + st.totalDays + '일)',
    '출석: ' + st.present + '일 / ' + st.totalDays + '일 (' + st.rate + '%)',
    '연속 출석: ' + st.streak + '일 (최장 기록 ' + st.bestStreak + '일)',
    '평균 체류 시간: ' + st.avgMinutes + '분',
    '등급: ' + st.grade
  ];
  if(st.noCheckout > 0){
    lines.push('하원 체크 누락: ' + st.noCheckout + '회');
  }
  return lines.join('\n');
}

// API 호출 (지침 9-2의 3분할 중 '호출' 담당)
async function callReportApi(data, tone){
  var res = await fetch('/api/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: data, tone: tone })
  });
  return await res.json();
}

// AI 결과를 화면에 표시 (지침 9-2의 3분할 중 '렌더링' 담당)
function renderReportText(text){
  var box = document.getElementById('reportOutput');
  box.innerHTML = '<div class="ro-box">' + text + '</div>'
    + '<button class="ro-copy" id="reportCopyBtn">복사하기</button>';

  document.getElementById('reportCopyBtn').addEventListener('click', function(){
    navigator.clipboard.writeText(text).then(function(){
      showToast('✅ 리포트가 복사되었습니다.');
    });
  });
}

// 리포트 생성 버튼 클릭 시 실행
async function generateReport(){
  var input = collectReportInput();
  if(!input) return;                       // 검증 실패 시 여기서 중단

  var st = weeklyStats(input.sid);
  renderReportStats(st);                   // 카드는 항상 지금 입력된 번호의 것으로 맞춘다

  // 이번 주 출결 기록이 0건이면 API를 호출하지 않는다 (S1 정의서 F-1)
  // 카드(0/5, 0%)는 그대로 두고 안내 문구만 띄운다
  if(st.present === 0){
    showReportMessage('error', '이번 주 출결 기록이 없습니다. 출결 현황 기록을 확인해주세요.');
    return;
  }

    // 이미 같은 조건으로 받아 둔 리포트가 있으면 API를 부르지 않는다 (제약 C5)
  var cacheKey = reportCacheKey(st, input.tone);
  if(reportCache[cacheKey]){
    renderReportText(reportCache[cacheKey]);
    showToast('이전에 생성한 리포트입니다.');
    return;
  }

  // 요청 중에는 버튼과 입력칸을 함께 잠근다
  // (연타로 인한 중복 호출·과금 방지, 제약 C5 / 대기 중 번호 변경 방지)
  var btn  = document.getElementById('reportBtn');
  var code = document.getElementById('reportCode');
  btn.disabled  = true;
  code.disabled = true;
  btn.textContent = '작성 중...';
  showReportMessage('info', 'AI가 리포트를 작성하고 있습니다. 잠시만 기다려 주세요.');

  try {
    var result = await callReportApi(buildReportData(st), input.tone);
    if(result.ok){
      saveReportCache(cacheKey, result.text);   // 메모리 + localStorage 양쪽에 저장
      renderReportText(result.text);
    } else {
      // 백엔드가 보내준 사용자용 문구를 그대로 표시한다
      showReportMessage('error', result.error || '리포트를 생성하지 못했습니다.');
    }
  } catch (e) {
    // 네트워크 자체가 끊긴 경우 (오프라인 등)
    console.error('리포트 요청 실패:', e);
    showReportMessage('error', '연결에 실패했습니다. 네트워크 상태를 확인해 주세요.');
  } finally {
    // 성공하든 실패하든 버튼·입력칸은 반드시 원래대로 되돌린다
    btn.disabled  = false;
    code.disabled = false;
    btn.textContent = '리포트 생성';
  }
}

document.addEventListener('DOMContentLoaded', function(){
  // 톤 선택 버튼
  var toneBtns = document.querySelectorAll('.tone-btn');
  toneBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      toneBtns.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      reportTone = btn.getAttribute('data-tone');
    });
  });

  // 생성 버튼
  var btn = document.getElementById('reportBtn');
  if(btn) btn.addEventListener('click', generateReport);

  // 번호 입력 — 숫자만 허용하고 이름·집계 카드를 실시간 갱신
  var codeInput = document.getElementById('reportCode');
  if(codeInput){
    codeInput.addEventListener('input', function(){
      this.value = this.value.replace(/\D/g, '').slice(0, 2);
      updateReportName();
      refreshReportStats();   // ← 카드도 이름과 같은 타이밍에 갱신
    });
  }
});