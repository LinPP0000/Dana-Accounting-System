const SVCS = ['剪髮','染髮','燙髮','護髮','頭皮護理','局部燙','局部染'];

function hash(str){
  let h=5381;
  for(let i=0;i<str.length;i++){h=((h<<5)+h)+str.charCodeAt(i);h=h&0xffffffff;}
  return String(h>>>0);
}

const DB={
  getCfg(){return JSON.parse(localStorage.getItem('xiugu_cfg')||'{}');},
  setCfg(c){localStorage.setItem('xiugu_cfg',JSON.stringify(c));},
  getRecords(){return JSON.parse(localStorage.getItem('xiugu_records')||'[]');},
  setRecords(r){localStorage.setItem('xiugu_records',JSON.stringify(r));},
  addRecord(rec){const r=this.getRecords();r.unshift(rec);this.setRecords(r);},
  updateRecord(id,patch){const r=this.getRecords();const i=r.findIndex(x=>x.id===id);if(i>=0){r[i]={...r[i],...patch};this.setRecords(r);}},
  deleteRecord(id){this.setRecords(this.getRecords().filter(x=>x.id!==id));}
};

function $(id){return document.getElementById(id);}
function fmtMoney(n){return Number(n||0).toLocaleString('en-US');}
function todayStr(){const d=new Date();return d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0');}
function nowTime(){const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200);}
function isDesktop(){return window.innerWidth>=1024||(window.innerWidth>=768&&window.innerHeight<window.innerWidth);}

/* ===== 登入 ===== */
function initLogin(){
  const setup=$('loginSetup'),normal=$('loginNormal');
  if(!setup||!normal)return;
  const cfg=DB.getCfg();
  if(!cfg.pw){setup.style.display='block';normal.style.display='none';}
  else{setup.style.display='none';normal.style.display='block';}
}

function doSetup(){
  const p1=$('setPw1').value,p2=$('setPw2').value,em=$('setEmail').value.trim();
  if(!p1){toast('請輸入密碼');return;}
  if(p1!==p2){toast('兩次密碼不一致');return;}
  if(!em||!em.includes('@')){toast('請填寫有效信箱');return;}
  const cfg=DB.getCfg();cfg.pw=hash(p1);cfg.email=em;DB.setCfg(cfg);
  toast('建立成功');enterApp();
}

function doLogin(){
  const cfg=DB.getCfg();
  if(hash($('loginPw').value)===cfg.pw){$('loginPw').value='';enterApp();}
  else toast('密碼錯誤');
}

function doLogout(){
  closeDrawer();
  $('app').classList.remove('active');
  $('login').classList.add('active');
  initLogin();
}

function enterApp(){
  $('login').classList.remove('active');
  $('app').classList.add('active');
  nav('add');
}

/* ===== 忘記密碼 ===== */
let _genCode='';
function openForgot(){$('forgotMask').classList.add('active');$('forgotStep1').style.display='block';$('forgotStep2').style.display='none';}
function closeForgot(){$('forgotMask').classList.remove('active');}
function sendCode(){
  const cfg=DB.getCfg();
  if(!cfg.email){toast('尚未設定救援信箱');return;}
  _genCode=String(Math.floor(100000+Math.random()*900000));
  if(cfg.emailjs&&cfg.emailjs.service&&window.emailjs){
    emailjs.send(cfg.emailjs.service,cfg.emailjs.template,{to_email:cfg.email,code:_genCode})
      .then(()=>{toast('驗證碼已寄出');$('forgotStep1').style.display='none';$('forgotStep2').style.display='block';})
      .catch(()=>toast('寄信失敗'));
  } else {
    alert('（尚未設定 Email）\n\n驗證碼：'+_genCode);
    $('forgotStep1').style.display='none';$('forgotStep2').style.display='block';
  }
}
function resetPw(){
  if($('fgCode').value.trim()!==_genCode){toast('驗證碼錯誤');return;}
  const np=$('fgNew').value;if(!np){toast('請輸入新密碼');return;}
  const cfg=DB.getCfg();cfg.pw=hash(np);DB.setCfg(cfg);toast('密碼已重設');closeForgot();initLogin();
}

/* ===== 導覽 ===== */
function openDrawer(){$('drawer').classList.add('active');$('drawerMask').classList.add('active');}
function closeDrawer(){$('drawer').classList.remove('active');$('drawerMask').classList.remove('active');}

function nav(view){
  closeDrawer();
  // 同步兩份導覽（側邊欄 + 抽屜）
  document.querySelectorAll('.di[data-view]').forEach(d=>{
    d.classList.toggle('on',d.dataset.view===view);
  });
  const area=$('viewArea');
  if(view==='add') area.innerHTML=viewAdd();
  else if(view==='today') area.innerHTML=viewToday();
  else if(view==='month') area.innerHTML=viewMonth();
  else if(view==='search') area.innerHTML=viewSearch();
  else if(view==='export') area.innerHTML=viewExport();
  else if(view==='settings') area.innerHTML=viewSettings();
  window.scrollTo(0,0);
  if(view==='add') afterAddRender();
  if(view==='month') renderMonth();
}

/* ===== 新增記錄 ===== */
let draft={svcs:[],sign:''};

function viewAdd(){
  return `<div class="body-pad">
    <div class="sec-title">✦ &nbsp; 新增記錄</div>
    <div class="field"><label class="flabel">客人姓名</label><input class="finput" id="inName" placeholder="輸入姓名"></div>
    <div class="field"><label class="flabel">電話</label><input class="finput" id="inPhone" placeholder="0900-000-000" inputmode="tel"></div>
    <div class="field">
      <label class="flabel">服務項目（可複選）</label>
      <div class="svc-grid" id="svcGrid"></div>
    </div>
    <div style="display:flex;gap:14px;">
      <div class="field" style="flex:1.4;"><label class="flabel">價格</label><input class="finput en" id="inPrice" placeholder="NT$ 0" inputmode="numeric"></div>
      <div class="field" style="flex:1;"><label class="flabel">日期</label><input class="finput" id="inDate" type="date"></div>
    </div>
    <div class="field">
      <label class="flabel">客人簽名（點擊放大簽名）</label>
      <div class="sign-prev" id="signPrev" onclick="openSign()">
        <span class="ph" id="signPh">點此簽名</span>
        <span class="zo">⛶</span>
      </div>
    </div>
    <button class="btn-metal" onclick="saveRecord()">SAVE &nbsp; 儲存</button>
  </div>`;
}

function afterAddRender(){
  draft={svcs:[],sign:''};
  $('svcGrid').innerHTML=SVCS.map(s=>
    `<div class="svc-box" data-s="${s}" onclick="toggleSvc('${s}')"><span class="nm">${s}</span><span class="ck">✓</span></div>`
  ).join('');
  const d=new Date();
  $('inDate').value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function toggleSvc(s){
  const i=draft.svcs.indexOf(s);
  if(i>=0)draft.svcs.splice(i,1);else draft.svcs.push(s);
  document.querySelector(`.svc-box[data-s="${s}"]`).classList.toggle('sel');
}

function saveRecord(){
  const name=$('inName').value.trim();
  const phone=$('inPhone').value.trim();
  const price=parseInt(($('inPrice').value||'').replace(/[^0-9]/g,''))||0;
  const dateInput=$('inDate').value;
  if(!name){toast('請填寫姓名');return;}
  if(draft.svcs.length===0){toast('請選擇服務項目');return;}
  if(!price){toast('請填寫價格');return;}
  const date=dateInput?dateInput.replace(/-/g,'/'):todayStr();
  const rec={id:'r'+Date.now(),name,phone,price,services:[...draft.svcs],date,time:nowTime(),sign:draft.sign,createdAt:new Date().toISOString()};
  DB.addRecord(rec);syncToSheets(rec);toast('已儲存 ✦');nav('add');
}

/* ===== 簽名 ===== */
let sctx,sdrawing=false,shasInk=false,scanvas;
let _signSkipped=false;

function openSign(){
  // 手機且非橫向：顯示提示
  const isMobile=window.innerWidth<768;
  const isPortrait=window.innerHeight>window.innerWidth;
  if(isMobile&&isPortrait&&!_signSkipped){
    $('landscapeHint').classList.add('show');
    return;
  }
  _signSkipped=false;
  _doOpenSign();
}

function skipLandscape(){
  $('landscapeHint').classList.remove('show');
  _signSkipped=true;
  _doOpenSign();
}

// 監聽轉橫向後自動開啟簽名
window.addEventListener('orientationchange',function(){
  if($('landscapeHint').classList.contains('show')){
    setTimeout(()=>{
      $('landscapeHint').classList.remove('show');
      _doOpenSign();
    },400);
  }
});

function _doOpenSign(){
  $('signModal').classList.add('active');
  scanvas=$('signCanvas');
  const rect=scanvas.parentElement.getBoundingClientRect();
  scanvas.width=rect.width;scanvas.height=rect.height;
  sctx=scanvas.getContext('2d');
  sctx.lineWidth=3;sctx.lineCap='round';sctx.lineJoin='round';sctx.strokeStyle='#111';
  shasInk=false;$('signHint').style.display='block';
  bindSign();
}

function bindSign(){
  const pos=e=>{
    const r=scanvas.getBoundingClientRect();
    const p=e.touches?e.touches[0]:e;
    return{x:p.clientX-r.left,y:p.clientY-r.top};
  };
  const start=e=>{e.preventDefault();sdrawing=true;shasInk=true;$('signHint').style.display='none';const{x,y}=pos(e);sctx.beginPath();sctx.moveTo(x,y);};
  const move=e=>{if(!sdrawing)return;e.preventDefault();const{x,y}=pos(e);sctx.lineTo(x,y);sctx.stroke();};
  const end=()=>{sdrawing=false;};
  scanvas.onmousedown=start;scanvas.onmousemove=move;scanvas.onmouseup=end;scanvas.onmouseleave=end;
  scanvas.ontouchstart=start;scanvas.ontouchmove=move;scanvas.ontouchend=end;
}

function signClear(){sctx.clearRect(0,0,scanvas.width,scanvas.height);shasInk=false;$('signHint').style.display='block';}
function signCancel(){$('signModal').classList.remove('active');}
function signDone(){
  if(!shasInk){toast('尚未簽名');return;}
  draft.sign=scanvas.toDataURL('image/png');
  $('signPrev').innerHTML=`<img src="${draft.sign}"><span class="zo">⛶</span>`;
  $('signModal').classList.remove('active');
}

/* ===== 今日營業額 ===== */
function viewToday(){
  const t=todayStr();
  const recs=DB.getRecords().filter(r=>r.date===t);
  const total=recs.reduce((s,r)=>s+r.price,0);
  const month=t.slice(0,7);
  const mRecs=DB.getRecords().filter(r=>r.date.slice(0,7)===month);
  const mTotal=mRecs.reduce((s,r)=>s+r.price,0);
  const list=recs.length?recs.map(r=>recCard(r)).join(''):'<div class="empty">今日尚無記錄</div>';
  return `<div class="body-pad">
    <div class="sec-title">✦ &nbsp; 今日營業額</div>
    <div class="stat-big">
      <div class="lb">TODAY · ${t.slice(5)}</div>
      <div class="num">NT$ ${fmtMoney(total)}</div>
      <div class="cnt">今日 ${recs.length} 筆服務</div>
    </div>
    <div class="stat-row">
      <div class="stat-sm"><div class="lb">本月累計</div><div class="num">NT$ ${fmtMoney(mTotal)}</div></div>
      <div class="stat-sm"><div class="lb">本月筆數</div><div class="num">${mRecs.length}</div></div>
    </div>
    <div class="sec-title" style="margin:28px 0 12px;font-size:11px;letter-spacing:0.3em;color:#666;font-weight:400;">今日記錄</div>
    ${list}
  </div>`;
}

function recCard(r){
  return `<div class="rec" onclick="openRec('${r.id}')">
    <div><div class="nm">${r.name}</div><div class="meta">${r.services.join('・')}　${r.time}</div></div>
    <div class="pr">$${fmtMoney(r.price)}</div>
  </div>`;
}

/* ===== 月結報表 ===== */
let mCur=new Date();
function viewMonth(){
  return `<div class="body-pad">
    <div class="sec-title">✦ &nbsp; 月結報表</div>
    <div class="msel">
      <button class="mbtn" onclick="mPrev()">‹</button>
      <span class="mtxt" id="mTxt"></span>
      <button class="mbtn" onclick="mNext()">›</button>
    </div>
    <div id="mBody"></div>
  </div>`;
}
function mPrev(){mCur.setMonth(mCur.getMonth()-1);renderMonth();}
function mNext(){mCur.setMonth(mCur.getMonth()+1);renderMonth();}
function renderMonth(){
  const y=mCur.getFullYear(),m=mCur.getMonth()+1;
  const key=y+'/'+String(m).padStart(2,'0');
  $('mTxt').textContent=y+'.'+String(m).padStart(2,'0');
  const recs=DB.getRecords().filter(r=>r.date.slice(0,7)===key);
  const total=recs.reduce((s,r)=>s+r.price,0);
  const svcCount={};
  recs.forEach(r=>r.services.forEach(s=>{svcCount[s]=(svcCount[s]||0)+1;}));
  const svcRows=Object.keys(svcCount).sort((a,b)=>svcCount[b]-svcCount[a])
    .map(s=>`<div class="svc-stat"><span class="k">${s}</span><span class="v">${svcCount[s]} 次</span></div>`).join('')
    ||'<div class="empty">本月無記錄</div>';
  const list=recs.length?recs.map(r=>recCardFull(r)).join(''):'';
  $('mBody').innerHTML=`
    <div class="stat-big">
      <div class="lb">MONTHLY · ${key.replace('/','.')}</div>
      <div class="num">NT$ ${fmtMoney(total)}</div>
      <div class="cnt">共 ${recs.length} 筆服務</div>
    </div>
    <div class="sec-title" style="margin:26px 0 8px;font-size:11px;letter-spacing:0.3em;color:#666;font-weight:400;">服務項目統計</div>
    ${svcRows}
    <div class="sec-title" style="margin:26px 0 12px;font-size:11px;letter-spacing:0.3em;color:#666;font-weight:400;">本月明細</div>
    ${list}`;
}
function recCardFull(r){
  return `<div class="rec" onclick="openRec('${r.id}')">
    <div><div class="nm">${r.name}</div><div class="meta">${r.date.slice(5)} ${r.time}　${r.services.join('・')}</div></div>
    <div class="pr">$${fmtMoney(r.price)}</div>
  </div>`;
}

/* ===== 搜尋 ===== */
function viewSearch(){
  return `<div class="body-pad">
    <div class="sec-title">✦ &nbsp; 搜尋客人</div>
    <div class="field"><input class="finput" id="searchIn" placeholder="輸入姓名或電話" oninput="runSearch()"></div>
    <div id="searchResult"><div class="empty">輸入關鍵字開始搜尋</div></div>
  </div>`;
}
function runSearch(){
  const q=$('searchIn').value.trim().toLowerCase();
  const box=$('searchResult');
  if(!q){box.innerHTML='<div class="empty">輸入關鍵字開始搜尋</div>';return;}
  const recs=DB.getRecords().filter(r=>(r.name||'').toLowerCase().includes(q)||(r.phone||'').includes(q));
  if(!recs.length){box.innerHTML='<div class="empty">找不到符合的記錄</div>';return;}
  const byName={};
  recs.forEach(r=>{const k=r.name+'|'+r.phone;(byName[k]=byName[k]||[]).push(r);});
  let html='';
  Object.keys(byName).forEach(k=>{
    const list=byName[k];const[nm,ph]=k.split('|');
    const sum=list.reduce((s,r)=>s+r.price,0);
    html+=`<div style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
        <div><span style="color:#f0f0f0;font-size:16px;font-weight:500;">${nm}</span><span class="search-result-meta">${ph||''}</span></div>
        <div style="font-size:11px;color:#666;">累計 <span class="en" style="color:#bbb;">$${fmtMoney(sum)}</span> · ${list.length}次</div>
      </div>
      ${list.map(r=>recCardFull(r)).join('')}
    </div>`;
  });
  box.innerHTML=html;
}

/* ===== 記錄詳情 ===== */
function openRec(id){
  const r=DB.getRecords().find(x=>x.id===id);if(!r)return;
  $('recMask').classList.add('active');
  $('recModalBody').innerHTML=`
    <div class="mt">${r.name}<span class="search-result-meta">${r.date} ${r.time}</span></div>
    <div class="svc-stat"><span class="k">電話</span><span class="v" style="font-family:inherit;color:#ddd;">${r.phone||'—'}</span></div>
    <div class="svc-stat"><span class="k">服務</span><span class="v" style="font-family:inherit;color:#ddd;">${r.services.join('、')}</span></div>
    <div class="svc-stat"><span class="k">價格</span><span class="v">NT$ ${fmtMoney(r.price)}</span></div>
    ${r.sign?`<div style="margin-top:16px;"><div class="flabel">簽名</div><div style="background:#f0f0f0;border-radius:8px;padding:10px;text-align:center;"><img src="${r.sign}" style="max-height:70px;max-width:100%;"></div></div>`:''}
    <div style="display:flex;gap:10px;margin-top:22px;">
      <button class="btn-ghost" style="flex:1;" onclick="editRec('${r.id}')">編輯</button>
      <button class="btn-ghost" style="flex:1;color:#c66;border-color:#3a1a1a;" onclick="delRec('${r.id}')">刪除</button>
    </div>
    <button class="btn-ghost" style="margin-top:10px;" onclick="closeRec()">關閉</button>`;
}
function closeRec(){$('recMask').classList.remove('active');}
function delRec(id){
  if(confirm('確定要刪除這筆記錄嗎？')){DB.deleteRecord(id);closeRec();toast('已刪除');nav(document.querySelector('.di.on')?document.querySelector('.di.on').dataset.view:'today');}
}
function editRec(id){
  const r=DB.getRecords().find(x=>x.id===id);if(!r)return;
  $('recModalBody').innerHTML=`
    <div class="mt">編輯記錄</div>
    <div class="field"><label class="flabel">姓名</label><input class="finput" id="eName" value="${r.name}"></div>
    <div class="field"><label class="flabel">電話</label><input class="finput" id="ePhone" value="${r.phone||''}"></div>
    <div class="field"><label class="flabel">價格</label><input class="finput en" id="ePrice" value="${r.price}" inputmode="numeric"></div>
    <button class="btn-metal" onclick="saveEdit('${r.id}')">儲存修改</button>
    <button class="btn-ghost" style="margin-top:10px;" onclick="openRec('${r.id}')">返回</button>`;
}
function saveEdit(id){
  const patch={name:$('eName').value.trim(),phone:$('ePhone').value.trim(),price:parseInt(($('ePrice').value||'').replace(/[^0-9]/g,''))||0};
  DB.updateRecord(id,patch);closeRec();toast('已更新');
  const cur=document.querySelector('.di.on');nav(cur?cur.dataset.view:'today');
}

/* ===== 匯出 ===== */
function viewExport(){
  return `<div class="body-pad">
    <div class="sec-title">✦ &nbsp; 匯出 Excel</div>
    <div style="color:#888;font-size:13px;line-height:1.9;margin-bottom:22px;">把記錄匯出成 Excel 檔，可存到手機或上傳雲端備份。</div>
    <div class="field"><label class="flabel">範圍</label>
      <select class="finput" id="expRange">
        <option value="all">全部記錄</option>
        <option value="month">本月</option>
      </select>
    </div>
    <button class="btn-metal" onclick="doExport()">匯出 EXCEL</button>
    <div class="diamond-sep">✦ &nbsp; ✦ &nbsp; ✦</div>
  </div>`;
}
function doExport(){
  const range=$('expRange').value;
  let recs=DB.getRecords();
  if(range==='month'){const k=todayStr().slice(0,7);recs=recs.filter(r=>r.date.slice(0,7)===k);}
  if(!recs.length){toast('沒有資料可匯出');return;}
  const rows=recs.map(r=>({日期:r.date,時間:r.time,姓名:r.name,電話:r.phone||'',服務項目:r.services.join('、'),價格:r.price,已簽名:r.sign?'是':'否'}));
  const ws=XLSX.utils.json_to_sheet(rows);
  ws['!cols']=[{wch:12},{wch:8},{wch:10},{wch:14},{wch:18},{wch:10},{wch:8}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'XIUGU 記錄');
  XLSX.writeFile(wb,`XIUGU_記錄_${todayStr().replace(/\//g,'')}.xlsx`);
  toast('已匯出');
}

/* ===== 設定 ===== */
function viewSettings(){
  const cfg=DB.getCfg();
  return `<div class="body-pad">
    <div class="sec-title">✦ &nbsp; 設定</div>
    <div class="field"><label class="flabel">救援信箱 EMAIL</label><input class="finput" id="stEmail" value="${cfg.email||''}"></div>
    <button class="btn-ghost" onclick="saveEmail()">更新信箱</button>
    <div class="diamond-sep">— 修改密碼 —</div>
    <div class="field"><label class="flabel">舊密碼</label><input type="password" class="finput" id="stOld"></div>
    <div class="field"><label class="flabel">新密碼</label><input type="password" class="finput" id="stNew"></div>
    <button class="btn-ghost" onclick="changePw()">更新密碼</button>
    <div class="diamond-sep">— Google Sheets 備份（選填）—</div>
    <div style="color:#666;font-size:12px;line-height:1.8;margin-bottom:14px;">貼上你的 Apps Script 網址，新記錄會自動同步備份。</div>
    <div class="field"><input class="finput" id="stSheet" placeholder="https://script.google.com/..." value="${cfg.sheetUrl||''}"></div>
    <button class="btn-ghost" onclick="saveSheet()">儲存網址</button>
    <div class="diamond-sep">✦ &nbsp; ✦ &nbsp; ✦</div>
  </div>`;
}
function saveEmail(){const c=DB.getCfg();c.email=$('stEmail').value.trim();DB.setCfg(c);toast('已更新信箱');}
function changePw(){
  const c=DB.getCfg();
  if(hash($('stOld').value)!==c.pw){toast('舊密碼錯誤');return;}
  if(!$('stNew').value){toast('請輸入新密碼');return;}
  c.pw=hash($('stNew').value);DB.setCfg(c);toast('密碼已更新');nav('settings');
}
function saveSheet(){const c=DB.getCfg();c.sheetUrl=$('stSheet').value.trim();DB.setCfg(c);toast('已儲存');}

function syncToSheets(rec){
  const c=DB.getCfg();if(!c.sheetUrl)return;
  fetch(c.sheetUrl,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({type:'record',...rec})}).catch(()=>{});
}

/* ===== 啟動 ===== */
document.addEventListener('DOMContentLoaded',function(){
  initLogin();
});
