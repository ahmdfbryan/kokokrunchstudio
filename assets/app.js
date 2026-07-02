const API = '/api';
let PACKAGE_ROWS = [];
let PACKAGES = {
  robux: { label:'Robux (Estimasi 5 Hari)', delivery:'Maks. 5 hari kerja', options:[] },
  gamepass: { label:'Robux via Gamepass (Instan)', delivery:'Instan, maks. 30 menit', options:[] }
};
const BASELINE_ROBUX = 0, BASELINE_CLIENT = 0;
const TESTIMONIALS = [
  {name:'Bagas R.', meta:'Order Gamepass · 1700 Robux', text:'Prosesnya cepet banget, kurang dari 20 menit Robux udah masuk ke akun. Adminnya juga fast response!', stars:5, color:'#FFC93C'},
  {name:'Nadia S.', meta:'Order Robux 5 Hari · 800 Robux', text:'Ambil yang metode 5 hari karena lebih hemat, dan bener-bener masuk sebelum hari ke-5. Recommended!', stars:5, color:'#5EEAD4'},
  {name:'Fikri A.', meta:'Order Gamepass · 400 Robux', text:'Awalnya ragu, tapi ternyata aman dan kode pesanan bisa dicek sendiri statusnya. Enak buat pantau progress.', stars:5, color:'#FF6B6B'}
];
const FAQS = [
  {q:'Berapa lama waktu pengiriman Robux?', a:'Gamepass instan biasanya diproses setelah pembayaran dikonfirmasi admin. Robux 5 Hari mengikuti proses Group Payout dan estimasinya maksimal 5 hari kerja.'},
  {q:'Apa yang harus dilakukan jika Robux belum masuk?', a:'Cek status melalui halaman Cek Pesanan memakai kode pesanan. Jika sudah melewati estimasi, hubungi admin dengan kode tersebut.'},
  {q:'Bagaimana cara beli Gift Gamepass?', a:'Pilih layanan Gamepass, tentukan nominal, isi data akun, upload bukti bayar, lalu admin akan memproses sesuai instruksi.'},
  {q:'Saya tidak bisa membuat Gamepass untuk pembelian Robux 5 Hari', a:'Pastikan akun memenuhi syarat Roblox dan sudah diverifikasi. Jika tetap gagal, hubungi admin.'},
  {q:'Apakah KokoKrunch Studio aman atau tidak?', a:'Setiap pembelian tercatat ke database dengan kode unik yang bisa dilacak statusnya.'},
  {q:'Apakah bisa melakukan refund?', a:'Refund hanya bisa diajukan jika pesanan belum diproses. Hubungi admin untuk pengecekan.'}
];
let selectedPkg = null, selectedPrice = 0, currentOrderType = 'robux', uploadedProof = '';
let DASH_PACKAGES = [], editingPackageId = null;
let CURRENT_USER = null;
function canManageTeam(){ return CURRENT_USER && ['owner','admin'].includes(String(CURRENT_USER.role||'').toLowerCase()); }
function rupiah(n){ return 'Rp' + Math.round(n).toLocaleString('id-ID'); }
function qs(name){ return new URLSearchParams(location.search).get(name); }
async function api(path, options={}){
  const headers = options.headers || {};
  if(!(options.body instanceof FormData)) headers['Content-Type']='application/json';
  const token = localStorage.getItem('kk_token');
  if(token) headers['Authorization']='Bearer '+token;
  const res = await fetch(API+path, {...options, headers});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || ('Terjadi kesalahan server. Status: '+res.status));
  return data;
}
function showToast(msg){ const t=document.getElementById('toast'); if(!t || !msg) return; t.textContent=msg; t.classList.add('show'); clearTimeout(t._hideTimer); t._hideTimer=setTimeout(()=>{ t.classList.remove('show'); t.textContent=''; },2600); }
function showFormErr(el,msg){ if(!el) return alert(msg); el.textContent=msg; el.style.display='block'; el.scrollIntoView({behavior:'smooth',block:'center'}); }
function animateCount(el,target,suffix=''){ if(!el)return; let start=performance.now(); function step(now){let p=Math.min(1,(now-start)/800); el.textContent=Math.round(target*(1-Math.pow(1-p,3))).toLocaleString('id-ID')+suffix; if(p<1)requestAnimationFrame(step)} requestAnimationFrame(step); }
async function loadPackages(){
  try{
    const data=await api('/packages');
    PACKAGE_ROWS=data.packages||[];
    ['robux','gamepass'].forEach(type=>{
      PACKAGES[type].options = PACKAGE_ROWS.filter(p=>p.type===type && Number(p.active)===1).sort((a,b)=>a.robux-b.robux);
    });
  }catch(e){
    PACKAGES.robux.options=[{robux:100,price:14200},{robux:200,price:28400},{robux:400,price:56800}];
    PACKAGES.gamepass.options=[{robux:100,price:16800},{robux:200,price:33600},{robux:400,price:67200}];
  }
}
function serviceLabel(type){ return PACKAGES[type]?.label || type; }

function navigateTo(url){
  closeMobileMenu?.();
  window.location.assign(url);
}
function go(url){ navigateTo(url); }
function showView(id){
  const map={home:'/index.html','pilih-layanan':'/layanan.html','cek-pesanan':'/cek-pesanan.html',login:'/login.html',dashboard:'/dashboard.html','order-success':'/order-success.html'};
  navigateTo(map[id]||'/index.html');
}
async function goLogin(){
  const token=localStorage.getItem('kk_token');
  if(token){
    try{ await api('/me'); window.location.assign('/dashboard.html'); return; }
    catch(e){ localStorage.removeItem('kk_token'); }
  }
  window.location.assign('/login.html');
}
function goOrderForm(type){ window.location.assign('/order.html?type='+encodeURIComponent(type)); }
function goPilihLayanan(type){ window.location.assign('/order.html?type='+encodeURIComponent(type)); }
function scrollToSection(id){ window.location.assign('/index.html#'+encodeURIComponent(id)); }

function toggleMobileMenu(event){
  if(event){ event.preventDefault(); event.stopPropagation(); }

  // Khusus dashboard: tombol mobile membuka sidebar dashboard, bukan menu website.
  if(document.body.classList.contains('dashboard-page')){
    const side=document.getElementById('dashSide');
    const burger=document.querySelector('.nav-burger');
    if(!side) return;
    const willOpen=!side.classList.contains('open');
    side.classList.toggle('open', willOpen);
    document.body.classList.toggle('dash-menu-open', willOpen);
    if(burger){
      burger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      burger.textContent = willOpen ? '✕' : '☰';
    }
    return;
  }

  const menu=document.querySelector('.nav-links');
  const burger=document.querySelector('.nav-burger');
  const nav=document.querySelector('.nav');
  if(!menu) return;

  const isOpen = !document.body.classList.contains('mobile-menu-open');

  if(isOpen){
    const top = nav ? Math.ceil(nav.getBoundingClientRect().bottom + 8) : 70;
    menu.classList.add('open');
    document.body.classList.add('mobile-menu-open');

    // FORCE style agar tidak kalah oleh CSS lama / cache / media query lain
    menu.style.display='flex';
    menu.style.position='fixed';
    menu.style.top=top+'px';
    menu.style.left='12px';
    menu.style.right='12px';
    menu.style.width='auto';
    menu.style.flexDirection='column';
    menu.style.alignItems='stretch';
    menu.style.gap='8px';
    menu.style.padding='12px';
    menu.style.background='#0F0A24';
    menu.style.border='1.5px solid rgba(255,255,255,.22)';
    menu.style.borderRadius='18px';
    menu.style.boxShadow='0 24px 55px rgba(0,0,0,.55)';
    menu.style.zIndex='2147483647';
  }else{
    closeMobileMenu();
    return;
  }

  if(burger){
    burger.setAttribute('aria-expanded','true');
    burger.textContent='✕';
  }
}
function closeMobileMenu(){
  const menu=document.querySelector('.nav-links');
  const burger=document.querySelector('.nav-burger');
  const side=document.getElementById('dashSide');

  if(side){ side.classList.remove('open'); }
  document.body.classList.remove('dash-menu-open');

  if(menu){
    menu.classList.remove('open');
    menu.removeAttribute('style');
  }
  document.body.classList.remove('mobile-menu-open');
  if(burger){
    burger.setAttribute('aria-expanded','false');
    burger.textContent='☰';
  }
}
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.addEventListener('resize',()=>{ if(window.innerWidth>900) closeMobileMenu(); });
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.nav-links a').forEach(a=>{
    a.addEventListener('click',(e)=>{
      const href=a.getAttribute('href');
      if(href && !href.startsWith('http') && !href.startsWith('#')){
        e.preventDefault();
        window.location.assign(href);
      }else{
        closeMobileMenu();
      }
    });
  });
  document.addEventListener('click',(e)=>{
    const nav=document.querySelector('.nav');
    const side=document.getElementById('dashSide');
    if(document.body.classList.contains('mobile-menu-open') && nav && !nav.contains(e.target)) closeMobileMenu();
    if(document.body.classList.contains('dash-menu-open') && side && nav && !side.contains(e.target) && !nav.contains(e.target)) closeMobileMenu();
  });
});
window.addEventListener('pageshow',()=>closeMobileMenu());
function bindHrefButtons(){
  document.querySelectorAll('[data-link]').forEach(el=>{ el.addEventListener('click',()=>window.location.assign(el.getAttribute('data-link'))); });
  document.querySelectorAll('[href]').forEach(el=>{ if(!['A','LINK'].includes(el.tagName)){ el.addEventListener('click',()=>window.location.assign(el.getAttribute('href'))); }});
}
async function initAuthNav(){
  const token=localStorage.getItem('kk_token');
  const navBtns=[...document.querySelectorAll('.nav-cta .btn-ghost')];
  const footerLoginLinks=[...document.querySelectorAll('footer a')].filter(a=>(a.textContent||'').trim().toLowerCase().includes('masuk tim'));
  if(!token){
    navBtns.forEach(btn=>{ btn.textContent='Masuk'; btn.removeAttribute('href'); btn.onclick=goLogin; });
    footerLoginLinks.forEach(a=>{ a.textContent='Masuk'; a.setAttribute('href','/login.html'); a.onclick=null; });
    return;
  }
  try{
    await api('/me');
    const isDashboard=location.pathname.endsWith('dashboard.html');
    navBtns.forEach(btn=>{
      btn.removeAttribute('href');
      if(isDashboard){
        btn.textContent='Keluar';
        btn.onclick=doLogout;
      }else{
        btn.textContent='Dashboard';
        btn.onclick=()=>window.location.assign('/dashboard.html');
      }
    });
    footerLoginLinks.forEach(a=>{ a.textContent='Dashboard'; a.setAttribute('href','/dashboard.html'); a.onclick=null; });
    if(location.pathname.endsWith('login.html')) window.location.replace('/dashboard.html');
  }catch(e){
    localStorage.removeItem('kk_token');
    navBtns.forEach(btn=>{ btn.textContent='Masuk'; btn.removeAttribute('href'); btn.onclick=goLogin; });
  }
}
function renderTestimonials(){ const g=document.getElementById('testiGrid'); if(!g)return; g.innerHTML=TESTIMONIALS.map(t=>`<div class="testi-card"><div class="testi-stars">${'★'.repeat(t.stars)}</div><p class="testi-text">${t.text}</p><div class="testi-user"><div class="testi-avatar" style="background:${t.color}">${t.name[0]}</div><div><div class="testi-name">${t.name}</div><div class="testi-meta">${t.meta}</div></div></div></div>`).join(''); }
function renderFaq(){ const f=document.getElementById('faqList'); if(!f)return; f.innerHTML=FAQS.map(x=>`<div class="faq-item"><button class="faq-q">${x.q}<span class="plus">+</span></button><div class="faq-a"><div class="faq-a-inner">${x.a}</div></div></div>`).join(''); f.querySelectorAll('.faq-q').forEach(b=>b.onclick=()=>{const item=b.parentElement; item.classList.toggle('open'); const a=item.querySelector('.faq-a'); a.style.maxHeight=item.classList.contains('open')?a.scrollHeight+'px':'0';}); }
function fillFromPrices(){
  const r=document.getElementById('fromPriceRobux'), g=document.getElementById('fromPriceGamepass');
  const minR=PACKAGES.robux.options[0], minG=PACKAGES.gamepass.options[0];
  if(r)r.textContent=minR?rupiah(minR.price):'-';
  if(g)g.textContent=minG?rupiah(minG.price):'-';
}
async function refreshStats(){ try{ const s=await api('/stats'); const robux=s.robux_sold, clients=s.clients, orders=s.finished_orders; ['heroStatRobux','statRobuxTotal'].forEach(id=>animateCount(document.getElementById(id),robux)); ['heroStatClient','statClientTotal'].forEach(id=>animateCount(document.getElementById(id),clients)); animateCount(document.getElementById('statOrderTotal'),orders); }catch(e){ console.warn(e); } }
function initOrder(){
  if(!document.getElementById('pkgGrid'))return;
  currentOrderType=qs('type')==='gamepass'?'gamepass':'robux';
  const pkg=PACKAGES[currentOrderType];
  document.getElementById('orderFormTitle').textContent='Form Pesanan '+pkg.label;
  document.getElementById('orderRateNote').textContent=`Pilih nominal yang tersedia · ${pkg.delivery}`;
  document.getElementById('sumLayanan').textContent=pkg.label;
  document.getElementById('sumEstimasi').textContent=pkg.delivery;
  const grid=document.getElementById('pkgGrid');
  if(!pkg.options.length){
    grid.innerHTML='<div class="empty-state" style="grid-column:1/-1;padding:20px">Belum ada nominal aktif untuk layanan ini.</div>';
  }else{
    grid.innerHTML=pkg.options.map(v=>`<button class="pkg-option" type="button" data-val="${v.robux}" data-price="${v.price}"><div class="amt">${Number(v.robux).toLocaleString('id-ID')} R$</div><div class="price">${rupiah(v.price)}</div></button>`).join('');
  }
  document.querySelectorAll('.pkg-option').forEach(b=>b.onclick=()=>{selectedPkg=+b.dataset.val; selectedPrice=+b.dataset.price; document.querySelectorAll('.pkg-option').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); updateSummary();});
  const u=document.getElementById('fUsername'); if(u)u.addEventListener('input',updateSummary);
}
function updateSummary(){ const u=document.getElementById('fUsername')?.value.trim()||'-'; document.getElementById('sumNominal').textContent=selectedPkg?selectedPkg.toLocaleString('id-ID')+' Robux':'-'; document.getElementById('sumTotal').textContent=selectedPkg?rupiah(selectedPrice):'Rp0'; document.getElementById('sumUsername').textContent=u; }
function handleProofUpload(e){ const file=e.target.files[0]; if(!file)return; if(file.size>3*1024*1024) return alert('Ukuran bukti maksimal 3MB.'); const r=new FileReader(); r.onload=ev=>{uploadedProof=ev.target.result; document.getElementById('uploadPreviewWrap').innerHTML=`<div class="upload-preview"><img src="${uploadedProof}" alt="preview bukti bayar"></div>`; document.getElementById('uploadPlaceholder').style.display='none';}; r.readAsDataURL(file); }
async function submitOrder(ev){
  const err=document.getElementById('orderFormErr');
  const submitBtn=(ev&&ev.currentTarget)||document.querySelector('.order-submit-btn'); const oldText=submitBtn?.innerHTML;
  const finish=()=>{ if(submitBtn){submitBtn.disabled=false; submitBtn.classList.remove('is-loading'); submitBtn.innerHTML=oldText;} };
  if(submitBtn){submitBtn.disabled=true; submitBtn.classList.add('is-loading'); submitBtn.innerHTML='<span class="mini-spinner"></span><span class="btn-label">Memproses order...</span>';}
  const username=document.getElementById('fUsername').value.trim();
  const discord=document.getElementById('fDiscord').value.trim();
  if(!selectedPkg){ finish(); return showFormErr(err,'Pilih nominal Robux terlebih dahulu.'); }
  if(!username){ finish(); return showFormErr(err,'Username Roblox wajib diisi.'); }
  if(!discord){ finish(); return showFormErr(err,'Username Discord wajib diisi.'); }
  if(!uploadedProof){ finish(); return showFormErr(err,'Upload bukti pembayaran terlebih dahulu.'); }
  try{ const data=await api('/orders',{method:'POST',body:JSON.stringify({type:currentOrderType,robux:selectedPkg,username,discord,proof:uploadedProof})}); window.location.assign('/order-success.html?code='+encodeURIComponent(data.code)); }
  catch(e){ showFormErr(err,e.message); finish(); }
}

async function initSuccess(){ const c=qs('code'); if(document.getElementById('successCode')&&c) document.getElementById('successCode').textContent=c; }
function goCekPesananWithCode(){ const c=document.getElementById('successCode').textContent; window.location.assign('/cek-pesanan.html?code='+encodeURIComponent(c)); }
async function cekPesanan(){ const input=(document.getElementById('cekCodeInput').value||'').trim().toUpperCase(); const err=document.getElementById('cekErr'), box=document.getElementById('cekResult'); if(!input)return showFormErr(err,'Masukkan kode pesanan terlebih dahulu.'); try{ err.style.display='none'; const order=await api('/orders/'+encodeURIComponent(input)); const steps=['Menunggu Konfirmasi','Diproses','Terkirim']; const currentIdx=steps.indexOf(order.status); const statusClass={'Menunggu Konfirmasi':'pending','Diproses':'proses','Terkirim':'selesai','Dibatalkan':'batal'}[order.status]||'pending'; box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px"><div><div class="mono" style="font-size:12px;color:var(--text-faint)">KODE PESANAN</div><div class="mono" style="font-size:22px;font-weight:700;color:var(--gold)">${order.code}</div></div><span class="status-pill ${statusClass}">${order.status}</span></div>${order.status==='Dibatalkan'?'':`<div class="stepper">${steps.map((s,i)=>`<div class="step ${i<=currentIdx?'done':''}"><div class="dot">${i<currentIdx?'✓':i+1}</div><span>${s}</span></div>`).join('')}</div>`}<div style="margin-top:22px"><div class="detail-row"><span>Layanan</span><span>${order.type_label}</span></div><div class="detail-row"><span>Nominal Robux</span><span>${order.robux.toLocaleString('id-ID')} Robux</span></div><div class="detail-row"><span>Total Bayar</span><span>${rupiah(order.price)}</span></div><div class="detail-row"><span>Username Roblox</span><span>${order.username}</span></div><div class="detail-row"><span>Estimasi Kirim</span><span>${order.delivery}</span></div><div class="detail-row" style="border-bottom:none"><span>Dibuat pada</span><span>${new Date(order.created_at).toLocaleString('id-ID')}</span></div></div>`; box.style.display='block'; }catch(e){ box.style.display='none'; showFormErr(err,'Kode pesanan tidak ditemukan.'); } }
async function doLogin(){ const err=document.getElementById('loginErr'); try{ const data=await api('/login',{method:'POST',body:JSON.stringify({username:document.getElementById('loginUser').value.trim(),password:document.getElementById('loginPass').value})}); localStorage.setItem('kk_token',data.token); window.location.assign('/dashboard.html'); }catch(e){ showFormErr(err,e.message||'Username atau password salah.'); } }
function doLogout(){ localStorage.removeItem('kk_token'); sessionStorage.clear(); window.location.replace('/index.html?logout=1'); }
async function requireAuth(){ if(!location.pathname.endsWith('dashboard.html')) return; try{ const me=await api('/me'); CURRENT_USER=me; document.getElementById('dashUserName').textContent=me.name; document.getElementById('dashUserRole').textContent=me.role; applyRoleAccess(); await renderDashboard(); }catch(e){ window.location.replace('/login.html'); } }
let ORDERS=[], TEAM=[], ORDER_NOTES=[], STATUS_LOGS=[], ACTIVITY_LOGS=[], currentFilter='all';
let ORDER_NOTIF_INITIALIZED=false;
let ORDER_NOTIF_CODES=new Set();
let ORDER_NOTIF_TIMER=null;
let ORDER_NOTIF_LAST_COUNT=0;
let ORDER_NOTIF_REFRESHING=false;
async function renderDashboard(){
  const data=await api('/dashboard');
  applyDashboardData(data);
  startOrderRealtimeWatcher();
}
function applyDashboardData(data){
  ORDERS=data.orders||[];
  TEAM=data.team||[];
  ORDER_NOTES=data.notes||[];
  STATUS_LOGS=data.status_logs||[];
  ACTIVITY_LOGS=data.activity_logs||[];
  DASH_PACKAGES=data.packages||[];
  if(data.services) SERVICES=data.services;
  if(data.payments) PAYMENTS=data.payments;
  renderKpis(data.stats);
  renderRecentOrders();
  renderOrdersTable();
  renderActivityLog();
  updateOrderNotifBadge();
  if(canManageTeam()){
    renderTeamGrid();
    renderPackagesAdmin();
    if(typeof renderServicesAdmin==='function') renderServicesAdmin();
    if(typeof renderPaymentsAdmin==='function') renderPaymentsAdmin();
  }
}
function pendingOrderCount(){
  return (ORDERS||[]).filter(o=>o.status==='Menunggu Konfirmasi').length;
}
function updateOrderNotifBadge(){
  const badge=document.getElementById('orderNotifBadge');
  if(!badge) return;
  const count=pendingOrderCount();
  badge.textContent=count>99?'99+':String(count);
  badge.style.display=count>0?'inline-flex':'none';
  badge.title=count>0?`${count} pesanan menunggu konfirmasi`:'Tidak ada pesanan baru';
}
function ensureDashboardAlertBox(){
  if(document.getElementById('dashboardOrderAlert')) return;
  const div=document.createElement('div');
  div.id='dashboardOrderAlert';
  div.className='dashboard-order-alert';
  div.innerHTML='<div class="ico">🔔</div><div><b>Pesanan baru masuk</b><p id="dashboardOrderAlertText">Ada pesanan baru yang perlu dicek.</p><button class="btn btn-mint btn-sm" type="button" onclick="openNewOrderFromAlert()">Lihat Pesanan</button></div>';
  document.body.appendChild(div);
}
function playOrderNotifSound(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx) return;
    const ctx=new AudioCtx();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type='sine'; osc.frequency.value=880; gain.gain.value=0.035;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); setTimeout(()=>{osc.stop(); ctx.close();},140);
  }catch(e){}
}
function showDashboardOrderAlert(order){
  ensureDashboardAlertBox();
  const box=document.getElementById('dashboardOrderAlert');
  const txt=document.getElementById('dashboardOrderAlertText');
  if(txt && order) txt.textContent=`${order.code} · ${order.username||'-'} · ${Number(order.robux||0).toLocaleString('id-ID')} Robux`;
  if(box){ box.classList.add('show'); clearTimeout(box._hideTimer); box._hideTimer=setTimeout(()=>box.classList.remove('show'),6500); }
  playOrderNotifSound();
}
function startOrderRealtimeWatcher(){
  if(!document.body.classList.contains('dashboard-page')) return;
  ensureDashboardAlertBox();
  if(!ORDER_NOTIF_INITIALIZED){
    ORDER_NOTIF_CODES = new Set((ORDERS||[]).map(o=>o.code));
    ORDER_NOTIF_LAST_COUNT = (ORDERS||[]).length;
    ORDER_NOTIF_INITIALIZED = true;
  }
  updateOrderNotifBadge();
  if(ORDER_NOTIF_TIMER) clearInterval(ORDER_NOTIF_TIMER);
  ORDER_NOTIF_TIMER=setInterval(checkNewOrdersNotification,2500);
}
async function checkNewOrdersNotification(){
  if(!document.body.classList.contains('dashboard-page') || !localStorage.getItem('kk_token') || ORDER_NOTIF_REFRESHING) return;
  ORDER_NOTIF_REFRESHING=true;
  try{
    const data=await api('/dashboard');
    const latest=data.orders||[];
    const newOrders=latest.filter(o=>!ORDER_NOTIF_CODES.has(o.code));
    applyDashboardData(data);
    latest.forEach(o=>ORDER_NOTIF_CODES.add(o.code));
    if(newOrders.length){
      showDashboardOrderAlert(newOrders[0]);
    }
  }catch(e){ console.warn('Order notification check failed:', e.message||e); }
  finally{ ORDER_NOTIF_REFRESHING=false; }
}
function openNewOrderFromAlert(){
  const box=document.getElementById('dashboardOrderAlert'); if(box) box.classList.remove('show');
  switchDashTab('pesanan');
}
function renderKpis(s){ if(!s)return; document.getElementById('kpiPendapatan').textContent=rupiah(s.revenue); document.getElementById('kpiRobux').textContent=s.robux_sold.toLocaleString('id-ID'); document.getElementById('kpiOrders').textContent=s.total_orders; document.getElementById('kpiPending').textContent=s.pending; }
function statusPill(s){ const c={'Menunggu Konfirmasi':'pending','Diproses':'proses','Terkirim':'selesai','Dibatalkan':'batal'}[s]||'pending'; return `<span class="status-pill ${c}">${s}</span>`; }
function renderRecentOrders(){ const b=document.getElementById('recentOrdersBody'); if(!b)return; b.innerHTML=ORDERS.slice(0,5).map(o=>`<tr><td class="mono">${o.code}</td><td>${o.type_label}</td><td>${o.robux}</td><td>${rupiah(o.price)}</td><td>${statusPill(o.status)}</td></tr>`).join('')||'<tr><td colspan="5">Belum ada pesanan.</td></tr>'; }
function filterOrders(s){ currentFilter=s; document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',c.dataset.status===s)); renderOrdersTable(); }
function orderNotes(code){ return ORDER_NOTES.filter(n=>n.order_code===code); }
function orderLogs(code){ return STATUS_LOGS.filter(l=>l.order_code===code).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)); }
function renderOrdersTable(){
  const b=document.getElementById('ordersBody'); if(!b)return;
  const q=(document.getElementById('orderSearch')?.value||'').toLowerCase().trim();
  const from=document.getElementById('orderDateFrom')?.value||'';
  const to=document.getElementById('orderDateTo')?.value||'';
  const rows=ORDERS.filter(o=>{
    if(currentFilter!=='all'&&o.status!==currentFilter)return false;
    const hay=[o.code,o.type_label,o.username,o.discord,o.status].join(' ').toLowerCase();
    if(q && !hay.includes(q)) return false;
    const d=(o.created_at||'').slice(0,10);
    if(from && d<from) return false;
    if(to && d>to) return false;
    return true;
  });
  document.getElementById('ordersEmpty').style.display=rows.length?'none':'block';
  b.innerHTML=rows.map(o=>`<tr>
    <td class="mono"><button class="link-btn mono" onclick="openOrderDetail('${o.code}')">${o.code}</button></td>
    <td>${new Date(o.created_at).toLocaleString('id-ID')}</td><td>${escapeHtml(o.type_label)}</td><td>${o.robux}</td><td>${escapeHtml(o.username)}</td><td>${escapeHtml(o.discord)}</td><td>${rupiah(o.price)}</td>
    <td><button class="link-btn" onclick="openProofModal('${o.code}')">Lihat</button></td>
    <td><button class="link-btn" onclick="openOrderDetail('${o.code}')">${orderNotes(o.code).length||0} Catatan</button></td>
    <td><button class="link-btn" onclick="openOrderDetail('${o.code}')">${orderLogs(o.code).length||0} Log</button></td>
    <td><select class="status-select" onchange="updateOrderStatus('${o.code}',this.value)">${['Menunggu Konfirmasi','Diproses','Terkirim','Dibatalkan'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></td>
  </tr>`).join('');
}
function resetOrderFilters(){ ['orderSearch','orderDateFrom','orderDateTo'].forEach(id=>{const el=document.getElementById(id); if(el)el.value='';}); currentFilter='all'; document.querySelectorAll('#statusFilterRow .chip').forEach(c=>c.classList.toggle('active',c.dataset.status==='all')); renderOrdersTable(); }

async function exportOrdersExcel(){
  try{
    const token=localStorage.getItem('kk_token');
    if(!token){ alert('Sesi login tidak valid. Silakan login ulang.'); location.href='/login.html'; return; }
    const res=await fetch('/api/export/orders',{headers:{'Authorization':'Bearer '+token}});
    if(!res.ok){
      const data=await res.json().catch(()=>({}));
      throw new Error(data.error || ('Gagal export. Status: '+res.status));
    }
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='laporan-pesanan-kokokrunch.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Laporan berhasil diexport.');
  }catch(e){ alert(e.message); }
}
async function updateOrderStatus(code,status){ await api('/orders/'+code+'/status',{method:'PUT',body:JSON.stringify({status})}); showToast('Status pesanan diperbarui.'); await renderDashboard(); }
function openProofModal(code){ const o=ORDERS.find(x=>x.code===code); if(!o)return; document.getElementById('proofModalImg').src=o.proof; document.getElementById('proofModalMeta').innerHTML=`Kode: <b class="mono">${o.code}</b> · Username: <b>${o.username}</b>`; document.getElementById('proofModalBg').classList.add('open'); }
function closeProofModal(){ document.getElementById('proofModalBg').classList.remove('open'); }
function openOrderDetail(code){
  const o=ORDERS.find(x=>x.code===code); if(!o)return;
  const notes=orderNotes(code); const logs=orderLogs(code);
  const el=document.getElementById('orderDetailContent');
  el.innerHTML=`<h3>Detail Pesanan <span class="mono" style="color:var(--gold)">${o.code}</span></h3>
    <div class="detail-row"><span>Status</span><span>${statusPill(o.status)}</span></div>
    <div class="detail-row"><span>Layanan</span><span>${escapeHtml(o.type_label)}</span></div>
    <div class="detail-row"><span>Robux</span><span>${o.robux.toLocaleString('id-ID')} Robux</span></div>
    <div class="detail-row"><span>Total</span><span>${rupiah(o.price)}</span></div>
    <div class="detail-row"><span>Username</span><span>${escapeHtml(o.username)}</span></div>
    <div class="detail-row"><span>Discord</span><span>${escapeHtml(o.discord)}</span></div>
    <div class="order-note-box"><h4>Catatan Admin</h4><textarea id="newOrderNote" rows="3" placeholder="Tulis catatan internal untuk pesanan ini..."></textarea><button id="saveOrderNoteBtn" class="btn btn-gold btn-sm" onclick="saveOrderNote('${o.code}')">Simpan Catatan</button></div>
    <h4 style="margin-top:18px">Riwayat Catatan</h4><div class="mini-log-list">${notes.map(n=>`<div class="mini-log"><b>${escapeHtml(n.user_name||'-')}</b><p>${escapeHtml(n.note)}</p><span>${new Date(n.created_at).toLocaleString('id-ID')}</span></div>`).join('')||'<p class="muted-small">Belum ada catatan.</p>'}</div>
    <h4 style="margin-top:18px">Riwayat Status</h4><div class="mini-log-list">${logs.map(l=>`<div class="mini-log"><b>${escapeHtml(l.old_status||'-')} → ${escapeHtml(l.new_status)}</b><p>Oleh ${escapeHtml(l.user_name||'-')}</p><span>${new Date(l.created_at).toLocaleString('id-ID')}</span></div>`).join('')||'<p class="muted-small">Belum ada riwayat perubahan status.</p>'}</div>`;
  document.getElementById('orderDetailModalBg').classList.add('open');
}
function closeOrderDetailModal(){ document.getElementById('orderDetailModalBg').classList.remove('open'); }
async function saveOrderNote(code){
  const noteEl=document.getElementById('newOrderNote');
  const note=(noteEl?.value||'').trim();
  if(!note)return alert('Catatan tidak boleh kosong.');
  const btn=document.getElementById('saveOrderNoteBtn');
  const oldText=btn?btn.textContent:'';
  try{
    if(btn){ btn.disabled=true; btn.textContent='Menyimpan...'; }
    await api('/orders/'+encodeURIComponent(code)+'/notes',{method:'POST',body:JSON.stringify({note})});
    if(noteEl) noteEl.value='';
    showToast('Catatan admin disimpan.');
    await renderDashboard();
    openOrderDetail(code);
  }catch(e){
    alert(e.message || 'Gagal menyimpan catatan.');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent=oldText||'Simpan Catatan'; }
  }
}
function renderActivityLog(){
  const box=document.getElementById('activityList'); if(!box)return;
  box.innerHTML=(ACTIVITY_LOGS||[]).map(a=>`<div class="activity-item"><div><b>${escapeHtml(a.action)}</b><p>${escapeHtml(a.detail||'')}</p></div><span>${escapeHtml(a.user_name||'-')} · ${new Date(a.created_at).toLocaleString('id-ID')}</span></div>`).join('')||'<div class="empty-state"><div class="ico">🧾</div>Belum ada log aktivitas.</div>';
}
async function changeMyPassword(){
  const err=document.getElementById('passwordErr');
  const current_password=document.getElementById('oldPassword').value;
  const new_password=document.getElementById('newPassword').value;
  const confirm=document.getElementById('confirmPassword').value;
  if(!current_password||!new_password)return showFormErr(err,'Isi password lama dan password baru.');
  if(new_password!==confirm)return showFormErr(err,'Konfirmasi password baru tidak sama.');
  try{ await api('/change-password',{method:'POST',body:JSON.stringify({current_password,new_password})}); ['oldPassword','newPassword','confirmPassword'].forEach(id=>document.getElementById(id).value=''); showToast('Password berhasil diperbarui.'); }
  catch(e){ showFormErr(err,e.message); }
}
function renderTeamGrid(){
  const g=document.getElementById('teamGrid');
  if(!g)return;
  if(!canManageTeam()){ g.innerHTML=''; return; }
  g.innerHTML=TEAM.map(t=>`
    <div class="team-member team-member-manage">
      <div class="team-avatar"></div>
      <div class="team-info">
        <b>${escapeHtml(t.name)}</b>
        <span>@${escapeHtml(t.username)}</span>
        <span class="role-badge">${escapeHtml(t.role)}</span>
      </div>
      <div class="team-actions">
        <button class="btn btn-ghost btn-sm" onclick="editTeamMember(${t.id})">Edit</button>
        <button class="btn btn-coral btn-sm" onclick="deleteTeamMember(${t.id})">Hapus</button>
      </div>
    </div>`).join('');
}
async function addTeamMember(){
  if(!canManageTeam()) return alert('Akses ditolak. Menu Akses Anggota hanya untuk Admin.');
  const err=document.getElementById('teamErr');
  const name=document.getElementById('newTeamName').value.trim(), username=document.getElementById('newTeamUser').value.trim(), password=document.getElementById('newTeamPass').value, role=document.getElementById('newTeamRole').value;
  if(!name||!username||!password)return showFormErr(err,'Nama, username, dan password wajib diisi.');
  try{
    await api('/team',{method:'POST',body:JSON.stringify({name,username,password,role})});
    resetTeamForm();
    showToast('Anggota tim berhasil ditambahkan.');
    await renderDashboard();
  }catch(e){ showFormErr(err,e.message); }
}
function editTeamMember(id){
  if(!canManageTeam()) return alert('Akses ditolak. Menu Akses Anggota hanya untuk Admin.');
  const t=TEAM.find(x=>x.id===id);
  if(!t)return;
  document.getElementById('newTeamName').value=t.name;
  document.getElementById('newTeamUser').value=t.username;
  document.getElementById('newTeamPass').value='';
  document.getElementById('newTeamRole').value=t.role;
  const btn=document.getElementById('teamSubmitBtn') || document.querySelector('.add-team-form button');
  btn.textContent='Simpan Edit';
  const title=document.getElementById('teamFormTitle'); if(title) title.textContent='Edit Akses Anggota';
  const passLabel=document.getElementById('teamPasswordLabel'); if(passLabel) passLabel.textContent='Password Baru (kosongkan jika tidak diubah)';
  btn.setAttribute('onclick',`saveEditTeamMember(${id})`);
  const cancel=document.getElementById('teamCancelBtn');
  if(cancel)cancel.style.display='inline-flex';

}
async function saveEditTeamMember(id){
  if(!canManageTeam()) return alert('Akses ditolak. Menu Akses Anggota hanya untuk Admin.');
  const err=document.getElementById('teamErr');
  const name=document.getElementById('newTeamName').value.trim(), username=document.getElementById('newTeamUser').value.trim(), password=document.getElementById('newTeamPass').value, role=document.getElementById('newTeamRole').value;
  if(!name||!username)return showFormErr(err,'Nama dan username wajib diisi.');
  try{
    await api('/team/'+id,{method:'PUT',body:JSON.stringify({name,username,password,role})});
    resetTeamForm();
    showToast('Anggota tim berhasil diperbarui.');
    await renderDashboard();
  }catch(e){ showFormErr(err,e.message); }
}
async function deleteTeamMember(id){
  if(!canManageTeam()) return alert('Akses ditolak. Menu Akses Anggota hanya untuk Admin.');
  const t=TEAM.find(x=>x.id===id);
  if(!t)return;
  if(!confirm(`Hapus anggota tim "${t.name}"?`))return;
  try{
    await api('/team/'+id,{method:'DELETE'});
    showToast('Anggota tim berhasil dihapus.');
    await renderDashboard();
  }catch(e){ alert(e.message); }
}
function resetTeamForm(){
  ['newTeamName','newTeamUser','newTeamPass'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
  const role=document.getElementById('newTeamRole'); if(role)role.value='Staff';
  const err=document.getElementById('teamErr'); if(err)err.style.display='none';
  const btn=document.getElementById('teamSubmitBtn') || document.querySelector('.add-team-form button');
  if(btn){ btn.textContent='+ Tambah'; btn.setAttribute('onclick','addTeamMember()'); }
  const title=document.getElementById('teamFormTitle'); if(title) title.textContent='Tambah / Edit Akses Anggota';
  const passLabel=document.getElementById('teamPasswordLabel'); if(passLabel) passLabel.textContent='Password';
  const cancel=document.getElementById('teamCancelBtn'); if(cancel)cancel.style.display='none';
}

function renderPackagesAdmin(){
  const body=document.getElementById('packagesBody');
  if(!body || !canManageTeam()) return;
  body.innerHTML=DASH_PACKAGES.map(p=>`<tr>
    <td>${serviceLabel(p.type)}</td>
    <td>${Number(p.robux).toLocaleString('id-ID')} Robux</td>
    <td>${rupiah(p.price)}</td>
    <td>${Number(p.active)?'<span class="status-pill selesai">Aktif</span>':'<span class="status-pill batal">Nonaktif</span>'}</td>
    <td><div class="package-actions"><button type="button" class="btn btn-ghost btn-sm" onclick="editPackage(${p.id})">Edit</button><button type="button" class="btn btn-coral btn-sm" onclick="deletePackage(${p.id})">Hapus</button></div></td>
  </tr>`).join('') || '<tr><td colspan="5">Belum ada nominal.</td></tr>';
}
function resetPackageForm(){
  editingPackageId=null;
  ['pkgRobux','pkgPrice'].forEach(id=>{const el=document.getElementById(id); if(el)el.value='';});
  const t=document.getElementById('pkgType'); if(t)t.value='robux';
  const a=document.getElementById('pkgActive'); if(a)a.checked=true;
  const e=document.getElementById('pkgErr'); if(e)e.style.display='none';
  const btn=document.getElementById('pkgSubmitBtn'); if(btn){btn.textContent='+ Tambah Nominal'; btn.setAttribute('onclick','savePackage()');}
  const cancel=document.getElementById('pkgCancelBtn'); if(cancel)cancel.style.display='none';
}
function editPackage(id){
  if(!canManageTeam()) return alert('Akses ditolak. Pengaturan nominal hanya untuk Admin.');
  const numId = Number(id);
  const p = DASH_PACKAGES.find(x => Number(x.id) === numId);
  if(!p){
    alert('Data nominal tidak ditemukan. Refresh halaman lalu coba lagi.');
    return;
  }
  editingPackageId = numId;
  const typeEl = document.getElementById('pkgType');
  const robuxEl = document.getElementById('pkgRobux');
  const priceEl = document.getElementById('pkgPrice');
  const activeEl = document.getElementById('pkgActive');
  if(typeEl) typeEl.value = p.type;
  if(robuxEl) robuxEl.value = p.robux;
  if(priceEl) priceEl.value = p.price;
  if(activeEl) activeEl.checked = !!Number(p.active);
  const btn = document.getElementById('pkgSubmitBtn');
  if(btn){
    btn.textContent = 'Simpan Edit';
    btn.setAttribute('onclick','savePackage()');
  }
  const cancel = document.getElementById('pkgCancelBtn');
  if(cancel) cancel.style.display='inline-flex';
  const formTitle = document.getElementById('pkgFormTitle');
  if(formTitle) formTitle.textContent = 'Edit Nominal Robux';
  const err = document.getElementById('pkgErr');
  if(err) err.style.display='none';
  document.getElementById('tab-nominal')?.scrollIntoView({behavior:'smooth', block:'start'});
}
async function savePackage(){
  if(!canManageTeam()) return alert('Akses ditolak. Pengaturan nominal hanya untuk Admin.');
  const err=document.getElementById('pkgErr');
  const payload={type:document.getElementById('pkgType').value, robux:Number(document.getElementById('pkgRobux').value), price:Number(document.getElementById('pkgPrice').value), active:document.getElementById('pkgActive').checked};
  if(!payload.robux || !payload.price) return showFormErr(err,'Nominal Robux dan harga wajib diisi.');
  try{
    if(editingPackageId){ await api('/packages/'+editingPackageId,{method:'PUT',body:JSON.stringify(payload)}); showToast('Nominal berhasil diperbarui.'); }
    else{ await api('/packages',{method:'POST',body:JSON.stringify(payload)}); showToast('Nominal berhasil ditambahkan.'); }
    resetPackageForm(); await renderDashboard(); await loadPackages(); fillFromPrices();
  }catch(e){ showFormErr(err,e.message); }
}
async function deletePackage(id){
  if(!canManageTeam()) return alert('Akses ditolak. Pengaturan nominal hanya untuk Admin.');
  const p=DASH_PACKAGES.find(x=>x.id===id); if(!p)return;
  if(!confirm(`Hapus nominal ${p.robux} Robux dari ${serviceLabel(p.type)}?`))return;
  try{ await api('/packages/'+id,{method:'DELETE'}); showToast('Nominal berhasil dihapus.'); await renderDashboard(); await loadPackages(); fillFromPrices(); }
  catch(e){ alert(e.message); }
}
function escapeHtml(v){ return String(v??'').replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
function applyRoleAccess(){
  const teamBtn=document.querySelector('.side-link[data-tab="tim"]');
  const packageBtn=document.querySelector('.side-link[data-tab="nominal"]');
  const teamTab=document.getElementById('tab-tim');
  const packageTab=document.getElementById('tab-nominal');
  if(!canManageTeam()){
    if(teamBtn) teamBtn.style.display='none';
    if(packageBtn) packageBtn.style.display='none';
    if(teamTab) teamTab.style.display='none';
    if(packageTab) packageTab.style.display='none';
  }else{
    if(teamBtn) teamBtn.style.display='flex';
    if(packageBtn) packageBtn.style.display='flex';
  }
}
function switchDashTab(tab){
  if(tab==='pesanan'){ ORDER_NOTIF_UNREAD=0; updateOrderNotifBadge(); const box=document.getElementById('dashboardOrderAlert'); if(box) box.classList.remove('show'); }
  if((tab==='tim'||tab==='nominal') && !canManageTeam()) tab='ringkasan';
  document.querySelectorAll('.dash-tab').forEach(x=>x.style.display='none');
  const target=document.getElementById('tab-'+tab);
  if(target) target.style.display='block';
  document.querySelectorAll('.side-link[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
}

// Pastikan fungsi aksi dashboard tetap bisa dipanggil dari tombol HTML di semua browser.
window.editPackage = editPackage;
window.deletePackage = deletePackage;
window.savePackage = savePackage;
window.resetPackageForm = resetPackageForm;


const KK_ROBLOX_POPUP_IMG='https://tr.rbxcdn.com/180DAY-19accf77fc7ea9c95df84278ce0e3de0/150/150/Image/Webp/noFilter';
let KK_SUCCESS_POPUP_TIMER=null;
let KK_SUCCESS_POPUP_ORDERS=[];
let KK_SUCCESS_POPUP_INDEX=0;
function isDesktopHome(){ return location.pathname.endsWith('/') || location.pathname.endsWith('/index.html') || location.pathname==='/'; }
function shouldShowSuccessPopup(){ return isDesktopHome() && window.matchMedia('(min-width: 901px)').matches; }
function maskInvoiceCode(code){
  code=String(code||'');
  if(!code) return '-';
  if(code.length<=6) return code.slice(0,2)+'***';
  return code.slice(0,3)+'••••'+code.slice(-3);
}
function relativeTimeLabel(dateText){
  const t=new Date(String(dateText||'').replace(' ','T')).getTime();
  if(!t) return 'Baru saja';
  const diff=Math.max(0, Math.floor((Date.now()-t)/1000));
  if(diff<60) return 'Baru saja';
  const min=Math.floor(diff/60);
  if(min<60) return `${min} menit lalu`;
  const jam=Math.floor(min/60);
  if(jam<24) return `${jam} jam lalu`;
  const hari=Math.floor(jam/24);
  return `${hari} hari lalu`;
}
function ensureSuccessPopup(){
  let box=document.getElementById('kkSuccessPopup');
  if(box) return box;
  box=document.createElement('div');
  box.id='kkSuccessPopup';
  box.className='success-purchase-popup';
  box.innerHTML=`
    <img class="success-purchase-img" src="${KK_ROBLOX_POPUP_IMG}" alt="Avatar Roblox">
    <div class="success-purchase-body">
      <div class="success-purchase-kicker"><span class="success-purchase-check">✓</span> Pesanan berhasil</div>
      <div class="success-purchase-title">Pembelian Robux selesai</div>
      <div class="success-purchase-meta" id="kkSuccessPopupMeta">Invoice - · - Robux</div>
      <div class="success-purchase-time" id="kkSuccessPopupTime">Baru saja</div>
    </div>`;
  document.body.appendChild(box);
  return box;
}
function showSuccessPurchasePopup(order){
  if(!shouldShowSuccessPopup() || !order) return;
  const box=ensureSuccessPopup();
  const img=box.querySelector('.success-purchase-img');
  const title=box.querySelector('.success-purchase-title');
  const meta=box.querySelector('#kkSuccessPopupMeta');
  const time=box.querySelector('#kkSuccessPopupTime');
  if(img) img.src=order.roblox_avatar_url || KK_ROBLOX_POPUP_IMG;
  if(title) title.textContent=`Pembelian ${order.type_label||'Robux'}`;
  if(meta) meta.textContent=`Invoice ${maskInvoiceCode(order.code)} · ${Number(order.robux||0).toLocaleString('id-ID')} Robux`;
  if(time) time.textContent=relativeTimeLabel(order.created_at);
  box.classList.remove('show');
  void box.offsetWidth;
  box.classList.add('show');
  clearTimeout(box._hideTimer);
  box._hideTimer=setTimeout(()=>box.classList.remove('show'),5000);
}
async function loadSuccessPurchasePopups(){
  if(!shouldShowSuccessPopup()) return;
  try{
    const data=await api('/public/success-popups?limit=8');
    KK_SUCCESS_POPUP_ORDERS=data.orders||[];
    if(!KK_SUCCESS_POPUP_ORDERS.length) return;
    showSuccessPurchasePopup(KK_SUCCESS_POPUP_ORDERS[0]);
    clearInterval(KK_SUCCESS_POPUP_TIMER);
    KK_SUCCESS_POPUP_TIMER=setInterval(()=>{
      if(!shouldShowSuccessPopup()) return;
      if(!KK_SUCCESS_POPUP_ORDERS.length) return;
      KK_SUCCESS_POPUP_INDEX=(KK_SUCCESS_POPUP_INDEX+1)%KK_SUCCESS_POPUP_ORDERS.length;
      showSuccessPurchasePopup(KK_SUCCESS_POPUP_ORDERS[KK_SUCCESS_POPUP_INDEX]);
    },18000);
  }catch(e){ console.warn('Success purchase popup failed:', e.message||e); }
}
window.addEventListener('resize',()=>{
  if(!shouldShowSuccessPopup()){
    const box=document.getElementById('kkSuccessPopup');
    if(box) box.classList.remove('show');
  }
});

window.addEventListener('DOMContentLoaded',async()=>{ bindHrefButtons(); await loadPackages(); initAuthNav(); renderTestimonials(); renderFaq(); fillFromPrices(); refreshStats(); if(document.getElementById('heroStatRobux')||document.getElementById('statRobuxTotal')) setInterval(refreshStats,5000); initOrder(); initSuccess(); if(document.getElementById('cekCodeInput')&&qs('code')){document.getElementById('cekCodeInput').value=qs('code'); cekPesanan();} loadSuccessPurchasePopups(); requireAuth(); });

/* =========================
   KOKOKRUNCH CMS V2.1 ADDONS
   Custom layanan + pembayaran + role staff ketat
========================= */
let SERVICES = [], PAYMENTS = [], DASH_SERVICES = [], DASH_PAYMENTS = [];
let editingServiceId = null, editingPaymentId = null, paymentQrisData = '', currentPaymentFilter = 'all';
const BANK_NAMES=['Bank BCA','Bank BRI','Bank Mandiri','Bank BNI','Bank CIMB Niaga','Bank Permata','Bank BTN','Bank BSI','Bank Danamon','Bank Lainnya'];
const WALLET_NAMES=['DANA','OVO','GoPay','ShopeePay','LinkAja','E-Wallet Lainnya'];

function isAdmin(){ return CURRENT_USER && ['owner','admin'].includes(String(CURRENT_USER.role||'').toLowerCase()); }
function activeServices(){ return SERVICES.filter(s=>Number(s.active)===1).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0)); }

async function loadServices(){
  try{
    const data = await api('/services');
    SERVICES = data.services || [];
    const active = activeServices();
    PACKAGES = {};
    active.forEach(s=>{
      PACKAGES[s.slug] = { label:s.name, delivery:s.delivery, icon:s.icon||'💎', badge:s.badge||'Layanan', description:s.description||'', button_style:s.button_style||'mint', options:[] };
    });
  }catch(e){ console.warn('Gagal load layanan', e); }
}

async function loadPayments(){
  try{ const data = await api('/payments'); PAYMENTS = data.payments || []; }
  catch(e){ PAYMENTS = []; }
}

async function loadPackages(){
  await loadServices();
  await loadPayments();
  try{
    const data=await api('/packages');
    PACKAGE_ROWS=data.packages||[];
    Object.keys(PACKAGES).forEach(type=>{
      PACKAGES[type].options = PACKAGE_ROWS.filter(p=>p.type===type && Number(p.active)===1).sort((a,b)=>a.robux-b.robux);
    });
    renderServicesPublic();
    renderPaymentInfo();
  }catch(e){ console.warn(e); }
}

function serviceLabel(type){
  const s = SERVICES.find(x=>x.slug===type);
  return s ? s.name : (PACKAGES[type]?.label || type);
}

function buttonClassByStyle(style){
  if(style==='gold') return 'btn-gold';
  if(style==='coral') return 'btn-coral';
  return 'btn-mint';
}
function minPriceForService(slug){
  const rows = (PACKAGE_ROWS||[]).filter(p=>p.type===slug && Number(p.active)===1).sort((a,b)=>a.price-b.price);
  return rows[0] ? rupiah(rows[0].price) : '-';
}
function renderServicesPublic(){
  const home = document.getElementById('homeServiceGrid');
  const page = document.getElementById('servicesPageGrid');
  const list = activeServices();
  if(home){
    home.innerHTML = list.map(s=>`<div class="service-card ${escapeHtml(s.slug)}">
      <div class="glow"></div><div class="service-icon">${escapeHtml(s.icon||'💎')}</div>
      <h3>${escapeHtml(s.name)}</h3><p class="desc">${escapeHtml(s.description||'')}</p>
      <ul class="service-list"><li>${escapeHtml(s.delivery||'Estimasi menyesuaikan admin')}</li><li>Nominal dan harga dapat berubah sesuai dashboard</li><li>Kode pesanan bisa dilacak</li></ul>
      <button class="btn ${buttonClassByStyle(s.button_style)} btn-block" data-link="/order.html?type=${encodeURIComponent(s.slug)}">Beli Sekarang</button>
    </div>`).join('') || '<div class="empty-state">Belum ada layanan aktif.</div>';
    bindHrefButtons();
  }
  if(page){
    page.innerHTML = list.map(s=>`<div class="pilih-card">
      <span class="eyebrow">${escapeHtml(s.icon||'💎')} ${escapeHtml(s.badge||'Layanan')}</span>
      <h3>${escapeHtml(s.name)}</h3>
      <div class="price-from">Mulai dari <b>${minPriceForService(s.slug)}</b></div>
      <ul><li>${escapeHtml(s.description||'')}</li><li>Estimasi: ${escapeHtml(s.delivery||'-')}</li><li>Status layanan aktif dari dashboard admin</li></ul>
      <button class="btn ${buttonClassByStyle(s.button_style)} btn-block" data-link="/order.html?type=${encodeURIComponent(s.slug)}">Beli Sekarang</button>
    </div>`).join('') || '<div class="empty-state">Belum ada layanan aktif.</div>';
    bindHrefButtons();
  }
}
function fillFromPrices(){ renderServicesPublic(); }

function paymentTypeLabel(t){ return t==='qris'?'QRIS':(t==='wallet'?'E-Wallet':'Bank'); }
function paymentIcon(t){ return t==='qris'?'📱':(t==='wallet'?'👛':'🏦'); }
function activePayments(){ return (PAYMENTS||[]).filter(p=>Number(p.active)===1).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0)); }
function renderPaymentInfo(){
  const box=document.getElementById('paymentInfo');
  const sel=document.getElementById('paymentSelect');
  if(!box) return;
  const list=activePayments();
  if(!list.length){
    if(sel) sel.innerHTML='<option>Hubungi Admin</option>';
    box.innerHTML='<div class="payment-empty">Metode pembayaran belum tersedia. Silakan hubungi admin.</div>';
    return;
  }
  if(sel){
    const current=sel.value;
    sel.innerHTML=list.map(p=>`<option value="${p.id}">${paymentIcon(p.payment_type)} ${escapeHtml(p.name)} - ${paymentTypeLabel(p.payment_type)}</option>`).join('');
    if([...sel.options].some(o=>o.value===current)) sel.value=current;
  }
  renderSelectedPayment();
}
function renderSelectedPayment(){
  const box=document.getElementById('paymentInfo');
  const sel=document.getElementById('paymentSelect');
  if(!box) return;
  const list=activePayments();
  const p=list.find(x=>String(x.id)===String(sel?.value)) || list[0];
  if(!p){ box.innerHTML='<div class="payment-empty">Metode pembayaran belum tersedia.</div>'; return; }
  const type=p.payment_type||'bank';
  const copyBtn=p.account_number?`<button type="button" class="copy-pay-btn" data-num="${escapeHtml(String(p.account_number))}" onclick="copyPaymentNumber(this.dataset.num)">Copy</button>`:'';
  if(type==='qris') {
    box.innerHTML=`<div class="selected-payment-card qris-card">
      <div class="selected-payment-head"><span>${paymentIcon(type)}</span><div><b>${escapeHtml(p.name)}</b><small>${paymentTypeLabel(type)}</small></div></div>
      ${p.qris_image?`<img src="${escapeHtml(p.qris_image)}" alt="QRIS ${escapeHtml(p.name)}" class="order-qris-img big">`:'<div class="payment-empty">Gambar QRIS belum diupload.</div>'}
      ${p.account_name?`<div class="payment-line"><span>Atas Nama</span><b>${escapeHtml(p.account_name)}</b></div>`:''}
      ${p.note?`<p class="payment-note">${escapeHtml(p.note)}</p>`:''}
    </div>`;
    return;
  }
  box.innerHTML=`<div class="selected-payment-card">
    <div class="selected-payment-head"><span>${paymentIcon(type)}</span><div><b>${escapeHtml(p.name)}</b><small>${paymentTypeLabel(type)}</small></div></div>
    <div class="payment-line"><span>Atas Nama</span><b>${escapeHtml(p.account_name||'-')}</b></div>
    <div class="payment-line"><span>${type==='wallet'?'Nomor HP':'Nomor Rekening'}</span><b class="mono">${escapeHtml(p.account_number||'-')}</b>${copyBtn}</div>
    ${p.note?`<p class="payment-note">${escapeHtml(p.note)}</p>`:''}
  </div>`;
}
async function copyPaymentNumber(num){ try{ await navigator.clipboard.writeText(num); showToast('Nomor pembayaran berhasil disalin.'); } catch(e){ alert(num); } }

function initOrder(){
  if(!document.getElementById('pkgGrid'))return;
  const requested = qs('type');
  currentOrderType = PACKAGES[requested] ? requested : (Object.keys(PACKAGES)[0] || 'robux');
  const pkg=PACKAGES[currentOrderType];
  if(!pkg){ document.getElementById('pkgGrid').innerHTML='<div class="empty-state">Belum ada layanan aktif.</div>'; return; }
  document.getElementById('orderFormTitle').textContent='Form Pesanan '+pkg.label;
  document.getElementById('orderRateNote').textContent=`Pilih nominal yang tersedia · ${pkg.delivery}`;
  document.getElementById('sumLayanan').textContent=pkg.label;
  document.getElementById('sumEstimasi').textContent=pkg.delivery;
  const grid=document.getElementById('pkgGrid');
  if(!pkg.options.length){ grid.innerHTML='<div class="empty-state" style="grid-column:1/-1;padding:20px">Belum ada nominal aktif untuk layanan ini.</div>'; }
  else{ grid.innerHTML=pkg.options.map(v=>`<button class="pkg-option" type="button" data-val="${v.robux}" data-price="${v.price}"><div class="amt">${Number(v.robux).toLocaleString('id-ID')} R$</div><div class="price">${rupiah(v.price)}</div></button>`).join(''); }
  document.querySelectorAll('.pkg-option').forEach(b=>b.onclick=()=>{selectedPkg=+b.dataset.val; selectedPrice=+b.dataset.price; document.querySelectorAll('.pkg-option').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); updateSummary();});
  const u=document.getElementById('fUsername'); if(u)u.addEventListener('input',updateSummary);
  renderPaymentInfo();
}

async function renderDashboard(){
  const data=await api('/dashboard');
  ORDERS=data.orders||[];
  TEAM=data.team||[];
  ORDER_NOTES=data.notes||[];
  STATUS_LOGS=data.status_logs||[];
  ACTIVITY_LOGS=data.activity_logs||[];
  DASH_PACKAGES=data.packages||[];
  DASH_SERVICES=data.services||[];
  DASH_PAYMENTS=data.payments||[];
  SERVICES = DASH_SERVICES.length ? DASH_SERVICES : SERVICES;
  PAYMENTS = DASH_PAYMENTS.length ? DASH_PAYMENTS : PAYMENTS;
  renderKpis(data.stats);
  renderRecentOrders();
  renderOrdersTable();
  renderActivityLog();
  if(isAdmin()){
    renderServicesAdmin();
    renderPackagesAdmin();
    renderPaymentsAdmin();
    renderTeamGrid();
  }
}

function applyRoleAccess(){
  ['layanan-admin','nominal','pembayaran','tim','aktivitas'].forEach(tab=>{
    const btn=document.querySelector(`.side-link[data-tab="${tab}"]`);
    const pane=document.getElementById('tab-'+tab);
    if(!isAdmin()){ if(btn)btn.style.display='none'; if(pane)pane.style.display='none'; }
    else{ if(btn)btn.style.display='flex'; }
  });
}
function switchDashTab(tab){
  if(tab==='pesanan'){ ORDER_NOTIF_UNREAD=0; updateOrderNotifBadge(); const box=document.getElementById('dashboardOrderAlert'); if(box) box.classList.remove('show'); }
  if(['tim','nominal','layanan-admin','pembayaran','aktivitas'].includes(tab) && !isAdmin()) tab='ringkasan';
  document.querySelectorAll('.dash-tab').forEach(x=>x.style.display='none');
  const target=document.getElementById('tab-'+tab); if(target) target.style.display='block';
  document.querySelectorAll('.side-link[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
}

function refreshPackageTypeOptions(){
  const sel=document.getElementById('pkgType'); if(!sel) return;
  const val=sel.value;
  sel.innerHTML=(DASH_SERVICES||SERVICES).map(s=>`<option value="${escapeHtml(s.slug)}">${escapeHtml(s.short_name || s.name)}</option>`).join('');
  if([...sel.options].some(o=>o.value===val)) sel.value=val;
}
function renderPackagesAdmin(){
  refreshPackageTypeOptions();
  const body=document.getElementById('packagesBody'); if(!body || !isAdmin()) return;
  body.innerHTML=DASH_PACKAGES.map(p=>`<tr>
    <td>${escapeHtml(serviceLabel(p.type))}</td><td>${Number(p.robux).toLocaleString('id-ID')} Robux</td><td>${rupiah(p.price)}</td>
    <td>${Number(p.active)?'<span class="status-pill selesai">Aktif</span>':'<span class="status-pill batal">Nonaktif</span>'}</td>
    <td><div class="package-actions"><button type="button" class="btn btn-ghost btn-sm" onclick="editPackage(${p.id})">Edit</button><button type="button" class="btn btn-coral btn-sm" onclick="deletePackage(${p.id})">Hapus</button></div></td>
  </tr>`).join('') || '<tr><td colspan="5">Belum ada nominal.</td></tr>';
}

function renderServicesAdmin(){
  const body=document.getElementById('servicesBody'); if(!body || !isAdmin()) return;
  body.innerHTML=DASH_SERVICES.map(s=>`<tr>
    <td>${s.sort_order}</td><td style="font-size:22px">${escapeHtml(s.icon||'')}</td><td><b>${escapeHtml(s.name)}</b><br><span class="mono">${escapeHtml(s.slug)}</span></td>
    <td>${escapeHtml(s.description||'')}</td><td>${escapeHtml(s.delivery||'-')}</td>
    <td>${Number(s.active)?'<span class="status-pill selesai">Aktif</span>':'<span class="status-pill batal">Nonaktif</span>'}</td>
    <td><div class="package-actions"><button class="btn btn-ghost btn-sm" onclick="editService(${s.id})">Edit</button><button class="btn btn-coral btn-sm" onclick="deleteService(${s.id})">Hapus</button></div></td>
  </tr>`).join('') || '<tr><td colspan="7">Belum ada layanan.</td></tr>';
}
function resetServiceForm(){
  editingServiceId=null; ['svcName','svcSlug','svcShort','svcIcon','svcBadge','svcDelivery','svcDesc'].forEach(id=>{const el=document.getElementById(id); if(el)el.value='';});
  const st=document.getElementById('svcStyle'); if(st)st.value='mint'; const o=document.getElementById('svcOrder'); if(o)o.value='1'; const a=document.getElementById('svcActive'); if(a)a.checked=true;
  const err=document.getElementById('serviceErr'); if(err)err.style.display='none'; const btn=document.getElementById('svcSubmitBtn'); if(btn)btn.textContent='+ Tambah Layanan'; const cancel=document.getElementById('svcCancelBtn'); if(cancel)cancel.style.display='none';
}
function editService(id){
  const s=DASH_SERVICES.find(x=>Number(x.id)===Number(id)); if(!s)return;
  editingServiceId=Number(id); document.getElementById('svcName').value=s.name||''; document.getElementById('svcSlug').value=s.slug||''; document.getElementById('svcSlug').disabled=true; document.getElementById('svcShort').value=s.short_name||''; document.getElementById('svcIcon').value=s.icon||''; document.getElementById('svcBadge').value=s.badge||''; document.getElementById('svcDelivery').value=s.delivery||''; document.getElementById('svcDesc').value=s.description||''; document.getElementById('svcStyle').value=s.button_style||'mint'; document.getElementById('svcOrder').value=s.sort_order||1; document.getElementById('svcActive').checked=!!Number(s.active); document.getElementById('svcSubmitBtn').textContent='Simpan Edit'; document.getElementById('svcCancelBtn').style.display='inline-flex';
}
async function saveService(){
  if(!isAdmin()) return alert('Akses ditolak.'); const err=document.getElementById('serviceErr');
  const payload={name:document.getElementById('svcName').value.trim(), slug:document.getElementById('svcSlug').value.trim(), short_name:document.getElementById('svcShort').value.trim(), icon:document.getElementById('svcIcon').value.trim(), badge:document.getElementById('svcBadge').value.trim(), delivery:document.getElementById('svcDelivery').value.trim(), description:document.getElementById('svcDesc').value.trim(), button_style:document.getElementById('svcStyle').value, sort_order:Number(document.getElementById('svcOrder').value||1), active:document.getElementById('svcActive').checked};
  if(!payload.name) return showFormErr(err,'Nama layanan wajib diisi.');
  try{ if(editingServiceId) await api('/services/'+editingServiceId,{method:'PUT',body:JSON.stringify(payload)}); else await api('/services',{method:'POST',body:JSON.stringify(payload)}); resetServiceForm(); showToast('Layanan berhasil disimpan.'); await renderDashboard(); await loadPackages(); }
  catch(e){ showFormErr(err,e.message); }
}
async function deleteService(id){ if(!confirm('Hapus layanan ini? Nominal pada layanan ini juga ikut terhapus.')) return; try{ await api('/services/'+id,{method:'DELETE'}); showToast('Layanan berhasil dihapus.'); await renderDashboard(); await loadPackages(); }catch(e){ alert(e.message); } }

function setPaymentFilter(type){
  currentPaymentFilter=type;
  document.querySelectorAll('[data-pay-filter]').forEach(b=>b.classList.toggle('active',b.dataset.payFilter===type));
  renderPaymentsAdmin();
}
function renderPaymentsAdmin(){
  const body=document.getElementById('paymentsBody'); if(!body || !isAdmin()) return;
  const rows=(DASH_PAYMENTS||[]).filter(p=>currentPaymentFilter==='all' || (p.payment_type||'bank')===currentPaymentFilter);
  body.innerHTML=rows.map(p=>`<tr>
    <td><span class="pay-type-badge ${escapeHtml(p.payment_type||'bank')}">${paymentTypeLabel(p.payment_type||'bank')}</span></td>
    <td>${p.sort_order}</td><td><b>${escapeHtml(p.name)}</b><br><small>${escapeHtml(p.note||'')}</small></td><td>${escapeHtml(p.account_name||'-')}</td><td class="mono">${escapeHtml(p.account_number||'-')}</td>
    <td>${p.qris_image?`<img class="dash-qris-thumb" src="${escapeHtml(p.qris_image)}" alt="QRIS">`:'-'}</td>
    <td>${Number(p.active)?'<span class="status-pill selesai">Aktif</span>':'<span class="status-pill batal">Nonaktif</span>'}</td>
    <td><div class="package-actions"><button class="btn btn-ghost btn-sm" onclick="editPayment(${p.id})">Edit</button><button class="btn btn-coral btn-sm" onclick="deletePayment(${p.id})">Hapus</button></div></td>
  </tr>`).join('') || '<tr><td colspan="8">Belum ada metode pembayaran.</td></tr>';
}
function populatePaymentNameOptions(type='bank', selected=''){
  const sel=document.getElementById('payNameSelect'), custom=document.getElementById('payNameCustom'), hidden=document.getElementById('payName');
  if(!sel || !custom || !hidden) return;
  const names=type==='wallet'?WALLET_NAMES:(type==='qris'?['QRIS']:BANK_NAMES);
  sel.innerHTML=names.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  const inList=names.includes(selected);
  if(type==='qris'){ sel.value='QRIS'; custom.style.display='none'; hidden.value='QRIS'; return; }
  sel.value=inList?selected:names[0];
  custom.style.display=inList?'none':'block';
  custom.value=inList?'':selected;
  hidden.value=inList?sel.value:(selected||sel.value);
  sel.onchange=()=>{
    const customMode=sel.value.includes('Lainnya');
    custom.style.display=customMode?'block':'none';
    hidden.value=customMode?(custom.value.trim()||sel.value):sel.value;
  };
  custom.oninput=()=>{ hidden.value=custom.value.trim() || sel.value; };
}
function updatePaymentFormType(selectedName=''){
  const type=document.getElementById('payType')?.value || 'bank';
  const nameLabel=document.getElementById('payNameLabel');
  const numberLabel=document.getElementById('payNumberLabel');
  const numberField=document.getElementById('payNumberField');
  const qrisField=document.getElementById('payQrisField');
  const accNumber=document.getElementById('payAccountNumber');
  if(nameLabel) nameLabel.textContent=type==='wallet'?'Nama E-Wallet':(type==='qris'?'Nama QRIS':'Nama Bank');
  if(numberLabel) numberLabel.textContent=type==='wallet'?'Nomor HP':(type==='qris'?'Nomor ID / Opsional':'Nomor Rekening');
  if(numberField) numberField.style.display=type==='qris'?'none':'';
  if(qrisField) qrisField.style.display=type==='qris'?'block':'none';
  if(accNumber) accNumber.placeholder=type==='wallet'?'081234567890':(type==='qris'?'Opsional':'1234567890');
  populatePaymentNameOptions(type, selectedName);
}
function resetPaymentForm(){
  editingPaymentId=null; paymentQrisData='';
  const type=document.getElementById('payType'); if(type) type.value='bank';
  ['payAccountName','payAccountNumber','payNote'].forEach(id=>{const el=document.getElementById(id); if(el)el.value='';});
  const o=document.getElementById('payOrder'); if(o)o.value='1'; const a=document.getElementById('payActive'); if(a)a.checked=true; const f=document.getElementById('payQris'); if(f)f.value=''; const prev=document.getElementById('payQrisPreview'); if(prev)prev.innerHTML=''; const err=document.getElementById('paymentErr'); if(err)err.style.display='none'; const btn=document.getElementById('paySubmitBtn'); if(btn)btn.textContent='+ Tambah Pembayaran'; const cancel=document.getElementById('payCancelBtn'); if(cancel)cancel.style.display='none';
  updatePaymentFormType();
}
function editPayment(id){
  const p=DASH_PAYMENTS.find(x=>Number(x.id)===Number(id)); if(!p)return;
  editingPaymentId=Number(id); paymentQrisData='';
  const type=document.getElementById('payType'); if(type) type.value=p.payment_type||'bank';
  updatePaymentFormType(p.name||'');
  document.getElementById('payName').value=p.name||''; document.getElementById('payAccountName').value=p.account_name||''; document.getElementById('payAccountNumber').value=p.account_number||''; document.getElementById('payNote').value=p.note||''; document.getElementById('payOrder').value=p.sort_order||1; document.getElementById('payActive').checked=!!Number(p.active); document.getElementById('paySubmitBtn').textContent='Simpan Edit'; document.getElementById('payCancelBtn').style.display='inline-flex'; document.getElementById('payQrisPreview').innerHTML=p.qris_image?`<img src="${escapeHtml(p.qris_image)}" alt="QRIS">`:'';
  document.getElementById('tab-pembayaran')?.scrollIntoView({behavior:'smooth', block:'start'});
}
function currentPaymentName(){
  const sel=document.getElementById('payNameSelect'), custom=document.getElementById('payNameCustom');
  if(!sel) return document.getElementById('payName')?.value.trim()||'';
  const name=sel.value.includes('Lainnya') ? custom.value.trim() : sel.value;
  const hidden=document.getElementById('payName'); if(hidden) hidden.value=name;
  return name;
}
async function savePayment(){
  if(!isAdmin()) return alert('Akses ditolak.'); const err=document.getElementById('paymentErr');
  const type=document.getElementById('payType').value;
  const payload={payment_type:type,name:currentPaymentName(), account_name:document.getElementById('payAccountName').value.trim(), account_number:document.getElementById('payAccountNumber').value.trim(), note:document.getElementById('payNote').value.trim(), qris_image:paymentQrisData, sort_order:Number(document.getElementById('payOrder').value||1), active:document.getElementById('payActive').checked};
  if(!payload.name) return showFormErr(err,'Nama metode pembayaran wajib diisi.');
  if(type!=='qris' && !payload.account_number) return showFormErr(err,'Nomor rekening/HP wajib diisi.');
  try{ if(editingPaymentId) await api('/payments/'+editingPaymentId,{method:'PUT',body:JSON.stringify(payload)}); else await api('/payments',{method:'POST',body:JSON.stringify(payload)}); resetPaymentForm(); showToast('Metode pembayaran berhasil disimpan.'); await renderDashboard(); await loadPayments(); renderPaymentInfo(); }
  catch(e){ showFormErr(err,e.message); }
}
async function deletePayment(id){ if(!confirm('Hapus metode pembayaran ini?')) return; try{ await api('/payments/'+id,{method:'DELETE'}); showToast('Metode pembayaran berhasil dihapus.'); await renderDashboard(); await loadPayments(); renderPaymentInfo(); }catch(e){ alert(e.message); } }

document.addEventListener('change', e=>{
  if(e.target && e.target.id==='payQris'){
    const file=e.target.files[0]; if(!file)return;
    if(file.size>4*1024*1024){ alert('Ukuran QRIS maksimal 4MB.'); e.target.value=''; return; }
    const r=new FileReader(); r.onload=ev=>{ paymentQrisData=ev.target.result; const prev=document.getElementById('payQrisPreview'); if(prev)prev.innerHTML=`<img src="${paymentQrisData}" alt="Preview QRIS">`; }; r.readAsDataURL(file);
  }
});

window.saveService=saveService; window.editService=editService; window.deleteService=deleteService; window.resetServiceForm=resetServiceForm;
window.savePayment=savePayment; window.editPayment=editPayment; window.deletePayment=deletePayment; window.resetPaymentForm=resetPaymentForm; window.updatePaymentFormType=updatePaymentFormType; window.setPaymentFilter=setPaymentFilter; window.renderSelectedPayment=renderSelectedPayment; window.copyPaymentNumber=copyPaymentNumber;
// kecil: aktifkan kembali input slug setelah batal/simpan layanan
const _resetServiceFormV2 = resetServiceForm;
resetServiceForm = function(){ _resetServiceFormV2(); const slug=document.getElementById('svcSlug'); if(slug) slug.disabled=false; };
window.resetServiceForm = resetServiceForm;


/* =========================================================
   V23 DASHBOARD SIDEBAR MOBILE FINAL
========================================================= */
function openDashboardSidebar(){
  const side=document.getElementById('dashSide');
  const btn=document.querySelector('.dashboard-menu-btn');
  if(!side) return;
  side.classList.add('open');
  document.body.classList.add('dash-sidebar-open');
  document.body.classList.add('dash-menu-open');
  if(btn){ btn.textContent='✕'; btn.setAttribute('aria-expanded','true'); }
}
function closeDashboardSidebar(){
  const side=document.getElementById('dashSide');
  const btn=document.querySelector('.dashboard-menu-btn');
  if(side) side.classList.remove('open');
  document.body.classList.remove('dash-sidebar-open');
  document.body.classList.remove('dash-menu-open');
  if(btn){ btn.textContent='☰'; btn.setAttribute('aria-expanded','false'); }
}
function toggleDashboardSidebar(event){
  if(event){ event.preventDefault(); event.stopPropagation(); }
  const side=document.getElementById('dashSide');
  if(!side) return;
  if(side.classList.contains('open')) closeDashboardSidebar();
  else openDashboardSidebar();
}

// Override fungsi lama agar tombol dashboard tidak membuka menu website.
const __oldToggleMobileMenu = window.toggleMobileMenu;
window.openDashboardSidebar=openDashboardSidebar;
window.closeDashboardSidebar=closeDashboardSidebar;
window.toggleDashboardSidebar=toggleDashboardSidebar;
window.toggleMobileMenu=function(event){
  if(document.body.classList.contains('dashboard-page')) return toggleDashboardSidebar(event);
  return typeof __oldToggleMobileMenu==='function' ? __oldToggleMobileMenu(event) : undefined;
};

// Tutup sidebar setelah memilih menu dashboard di mobile.
document.addEventListener('DOMContentLoaded',()=>{
  if(!document.body.classList.contains('dashboard-page')) return;
  document.querySelectorAll('#dashSide .side-link').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(window.innerWidth<=900) setTimeout(closeDashboardSidebar,80);
    });
  });
});

// Override switchDashTab agar sidebar tertutup setelah klik menu.
if(typeof switchDashTab==='function'){
  const __v23SwitchDashTab=switchDashTab;
  window.switchDashTab=function(tab){
    __v23SwitchDashTab(tab);
    if(document.body.classList.contains('dashboard-page') && window.innerWidth<=900){
      closeDashboardSidebar();
    }
  };
}
window.addEventListener('resize',()=>{ if(window.innerWidth>900) closeDashboardSidebar(); });

/* =========================================================
   V24 DESKTOP RESIZE FIX
   Membersihkan state mobile ketika viewport kembali desktop.
========================================================= */
function resetDashboardDesktopState(){
  if(!document.body.classList.contains('dashboard-page')) return;
  if(window.innerWidth <= 900) return;
  const side=document.getElementById('dashSide');
  const btn=document.querySelector('.dashboard-menu-btn, .nav-burger');
  const backdrop=document.querySelector('.dash-backdrop');
  if(side) side.classList.remove('open');
  document.body.classList.remove('dash-sidebar-open','dash-menu-open','mobile-menu-open');
  if(btn){ btn.textContent='☰'; btn.setAttribute('aria-expanded','false'); }
  if(backdrop) backdrop.style.display='none';
}
window.addEventListener('resize', resetDashboardDesktopState);
window.addEventListener('orientationchange', ()=>setTimeout(resetDashboardDesktopState,120));
document.addEventListener('DOMContentLoaded', resetDashboardDesktopState);

window.resetOrderFilters=resetOrderFilters;
window.exportOrdersExcel=exportOrdersExcel;
window.openOrderDetail=openOrderDetail;
window.closeOrderDetailModal=closeOrderDetailModal;
window.saveOrderNote=saveOrderNote;
window.changeMyPassword=changeMyPassword;


/* =========================================================
   V29 CHECKOUT HALAMAN TERPISAH
   Detail Pesanan -> Metode Pembayaran -> Konfirmasi Order
========================================================= */
let ROBLOX_LOOKUP_TIMER=null;
let ROBLOX_PROFILE=null;
function checkoutKey(){ return 'kk_checkout_v29'; }
function getCheckoutDraft(){ try{return JSON.parse(sessionStorage.getItem(checkoutKey())||'{}')||{};}catch(e){return {};} }
function setCheckoutDraft(patch){ const d={...getCheckoutDraft(), ...patch}; sessionStorage.setItem(checkoutKey(), JSON.stringify(d)); return d; }
function clearCheckoutDraft(){ sessionStorage.removeItem(checkoutKey()); }
function selectedService(){ return PACKAGES[currentOrderType] || Object.values(PACKAGES)[0] || {}; }
function findPaymentById(id){ return (PAYMENTS||[]).find(p=>String(p.id)===String(id)); }
function selectedPaymentFromSelect(){ const sel=document.getElementById('paymentSelect'); const list=activePayments(); return list.find(p=>String(p.id)===String(sel?.value)) || list[0] || null; }
function ensureCheckoutOrBack(requirePayment=false){ const d=getCheckoutDraft(); if(!d.type || !d.robux || !d.username || !d.discord){ window.location.replace('/layanan.html'); return null; } if(requirePayment && (!d.payment_id || !d.proof)){ window.location.replace('/payment.html'); return null; } return d; }
function fillCheckoutSummary(d){
  if(!d) d=getCheckoutDraft();
  const pkg=PACKAGES[d.type] || {label:d.type_label||d.type||'-', delivery:d.delivery||'-'};
  const set=(id,val)=>{ const el=document.getElementById(id); if(el)el.textContent=val; };
  set('sumLayanan', d.type_label || pkg.label || '-');
  set('sumNominal', d.robux ? Number(d.robux).toLocaleString('id-ID')+' Robux' : '-');
  set('sumEstimasi', d.delivery || pkg.delivery || '-');
  set('sumUsername', d.username || '-');
  set('sumTotal', d.price ? rupiah(Number(d.price)) : 'Rp0');
}


function setRobloxPreview(state, profile){
  const av=document.getElementById('robloxAvatarPreview');
  const st=document.getElementById('robloxLookupStatus');
  if(!av || !st) return;
  av.classList.remove('found','loading','error');
  if(state==='idle'){
    av.innerHTML='<span>👤</span>'; st.textContent='Ketik username Roblox untuk menampilkan foto profil.'; ROBLOX_PROFILE=null; return;
  }
  if(state==='loading'){
    av.classList.add('loading'); av.innerHTML='<span class="mini-spinner"></span>'; st.textContent='Mencari akun Roblox...'; return;
  }
  if(state==='found' && profile){
    ROBLOX_PROFILE=profile;
    av.classList.add('found'); av.innerHTML=profile.avatar?`<img src="${escapeHtml(profile.avatar)}" alt="Avatar ${escapeHtml(profile.username)}">`:'<span>✓</span>';
    st.innerHTML=`<b>${escapeHtml(profile.username)}</b>${profile.displayName?` · ${escapeHtml(profile.displayName)}`:''} ditemukan.`;
    setCheckoutDraft({roblox_user_id:profile.id||'',roblox_avatar_url:profile.avatar||'',roblox_display_name:profile.displayName||'', username:profile.username||document.getElementById('fUsername')?.value.trim()||''});
    return;
  }
  av.classList.add('error'); av.innerHTML='<span>!</span>'; st.textContent=(profile&&profile.error)||'Akun Roblox tidak ditemukan.'; ROBLOX_PROFILE=null;
}
async function lookupRobloxUsername(username){
  username=(username||'').trim();
  if(username.length<3){ setRobloxPreview('idle'); return; }
  setRobloxPreview('loading');
  try{
    const data=await api('/roblox/lookup?username='+encodeURIComponent(username));
    if(data.found){
      const input=document.getElementById('fUsername');
      if(input && input.value.trim().toLowerCase()===username.toLowerCase()) setRobloxPreview('found',data);
    }else{
      setRobloxPreview('error',data);
    }
  }catch(e){ setRobloxPreview('error',{error:e.message||'Gagal mengambil profil Roblox.'}); }
}
function scheduleRobloxLookup(){
  const input=document.getElementById('fUsername');
  const username=input?.value.trim()||'';
  updateSummary();
  if(ROBLOX_LOOKUP_TIMER) clearTimeout(ROBLOX_LOOKUP_TIMER);
  ROBLOX_LOOKUP_TIMER=setTimeout(()=>lookupRobloxUsername(username),650);
}
function restoreRobloxPreviewFromDraft(d){
  if(d && d.roblox_avatar_url){
    setRobloxPreview('found',{id:d.roblox_user_id||'',username:d.username||'',displayName:d.roblox_display_name||'',avatar:d.roblox_avatar_url});
  }else if(d && d.username){
    scheduleRobloxLookup();
  }else{
    setRobloxPreview('idle');
  }
}

// Override initOrder lama: halaman order sekarang hanya untuk Detail Pesanan.
function initOrder(){
  if(!document.getElementById('pkgGrid')) return;
  const draft=getCheckoutDraft();
  const requested = qs('type') || draft.type;
  currentOrderType = PACKAGES[requested] ? requested : (Object.keys(PACKAGES)[0] || 'robux');
  const pkg=PACKAGES[currentOrderType];
  const title=document.getElementById('orderFormTitle'); if(title) title.textContent='Detail Pesanan '+(pkg?.label||'');
  const note=document.getElementById('orderRateNote'); if(note) note.textContent=`Pilih nominal yang tersedia · ${pkg?.delivery||'-'}`;
  const grid=document.getElementById('pkgGrid');
  if(!pkg || !pkg.options.length){ grid.innerHTML='<div class="empty-state" style="grid-column:1/-1;padding:20px">Belum ada nominal aktif untuk layanan ini.</div>'; }
  else{ grid.innerHTML=pkg.options.map(v=>`<button class="pkg-option" type="button" data-val="${v.robux}" data-price="${v.price}"><div class="amt">${Number(v.robux).toLocaleString('id-ID')} R$</div><div class="price">${rupiah(v.price)}</div></button>`).join(''); }
  if(draft.type===currentOrderType && draft.robux){ selectedPkg=Number(draft.robux); selectedPrice=Number(draft.price||0); }
  document.querySelectorAll('.pkg-option').forEach(b=>{
    if(Number(b.dataset.val)===Number(selectedPkg)) b.classList.add('selected');
    b.onclick=()=>{ selectedPkg=+b.dataset.val; selectedPrice=+b.dataset.price; document.querySelectorAll('.pkg-option').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); updateSummary(); };
  });
  const u=document.getElementById('fUsername'); const dsc=document.getElementById('fDiscord');
  if(u){ u.value=draft.username||''; u.addEventListener('input',scheduleRobloxLookup); }
  if(dsc){ dsc.value=draft.discord||''; }
  restoreRobloxPreviewFromDraft(draft);
  const s=getCheckoutDraft();
  setCheckoutDraft({type:currentOrderType,type_label:pkg?.label||currentOrderType,delivery:pkg?.delivery||''});
  updateSummary(); fillCheckoutSummary({...s,type:currentOrderType,type_label:pkg?.label,delivery:pkg?.delivery,robux:selectedPkg,price:selectedPrice,username:u?.value||''});
}
function saveCheckoutDetail(){
  const err=document.getElementById('orderFormErr'); if(err)err.style.display='none';
  const username=document.getElementById('fUsername')?.value.trim();
  const discord=document.getElementById('fDiscord')?.value.trim();
  const pkg=PACKAGES[currentOrderType]||{};
  if(!selectedPkg) return showFormErr(err,'Pilih nominal Robux terlebih dahulu.');
  if(!username) return showFormErr(err,'Username Roblox wajib diisi.');
  if(!discord) return showFormErr(err,'Username Discord wajib diisi.');
  setCheckoutDraft({type:currentOrderType,type_label:pkg.label||currentOrderType,delivery:pkg.delivery||'',robux:selectedPkg,price:selectedPrice,username,discord,roblox_user_id:ROBLOX_PROFILE?.id||getCheckoutDraft().roblox_user_id||'',roblox_avatar_url:ROBLOX_PROFILE?.avatar||getCheckoutDraft().roblox_avatar_url||'',roblox_display_name:ROBLOX_PROFILE?.displayName||getCheckoutDraft().roblox_display_name||''});
  window.location.assign('/payment.html');
}
function backToDetailOrder(){ const d=getCheckoutDraft(); window.location.assign('/order.html?type='+encodeURIComponent(d.type||currentOrderType||'robux')); }
function backToPaymentStep(){ window.location.assign('/payment.html'); }

function initPaymentStep(){
  if(!document.getElementById('view-payment-step')) return;
  const d=ensureCheckoutOrBack(false); if(!d) return;
  currentOrderType=d.type; selectedPkg=Number(d.robux); selectedPrice=Number(d.price);
  fillCheckoutSummary(d);
  renderPaymentInfo();
  const sel=document.getElementById('paymentSelect');
  if(sel && d.payment_id && [...sel.options].some(o=>o.value===String(d.payment_id))) sel.value=String(d.payment_id);
  renderSelectedPayment();
  if(d.proof){
    uploadedProof=d.proof;
    const wrap=document.getElementById('uploadPreviewWrap'); const ph=document.getElementById('uploadPlaceholder');
    if(wrap) wrap.innerHTML=`<div class="upload-preview"><img src="${uploadedProof}" alt="preview bukti bayar"></div>`;
    if(ph) ph.style.display='none';
  }
}
function saveSelectedPaymentDraft(){ const p=selectedPaymentFromSelect(); if(p) setCheckoutDraft({payment_id:p.id,payment_name:p.name,payment_type:p.payment_type, payment_account_name:p.account_name||'', payment_account_number:p.account_number||'', payment_qris_image:p.qris_image||'', payment_note:p.note||''}); }
function saveProofDraft(){ if(uploadedProof) setCheckoutDraft({proof:uploadedProof}); }
function savePaymentStep(){
  const err=document.getElementById('paymentFormErr'); if(err)err.style.display='none';
  const d=ensureCheckoutOrBack(false); if(!d) return;
  const p=selectedPaymentFromSelect();
  if(!p) return showFormErr(err,'Pilih metode pembayaran terlebih dahulu.');
  if(!uploadedProof) return showFormErr(err,'Upload bukti pembayaran terlebih dahulu.');
  setCheckoutDraft({payment_id:p.id,payment_name:p.name,payment_type:p.payment_type,payment_account_name:p.account_name||'',payment_account_number:p.account_number||'',payment_qris_image:p.qris_image||'',payment_note:p.note||'',proof:uploadedProof});
  window.location.assign('/confirm-order.html');
}

function paymentPreviewHtml(p){
  if(!p) return '<div class="payment-empty">Metode pembayaran belum dipilih.</div>';
  const type=p.payment_type||'bank';
  if(type==='qris') return `<div class="selected-payment-card qris-card"><div class="selected-payment-head"><span>${paymentIcon(type)}</span><div><b>${escapeHtml(p.name||'QRIS')}</b><small>${paymentTypeLabel(type)}</small></div></div>${p.qris_image?`<img src="${escapeHtml(p.qris_image)}" alt="QRIS" class="order-qris-img big">`:''}${p.account_name?`<div class="payment-line"><span>Atas Nama</span><b>${escapeHtml(p.account_name)}</b></div>`:''}${p.note?`<p class="payment-note">${escapeHtml(p.note)}</p>`:''}</div>`;
  return `<div class="selected-payment-card"><div class="selected-payment-head"><span>${paymentIcon(type)}</span><div><b>${escapeHtml(p.name||'-')}</b><small>${paymentTypeLabel(type)}</small></div></div><div class="payment-line"><span>Atas Nama</span><b>${escapeHtml(p.account_name||'-')}</b></div><div class="payment-line"><span>${type==='wallet'?'Nomor HP':'Nomor Rekening'}</span><b class="mono">${escapeHtml(p.account_number||'-')}</b></div>${p.note?`<p class="payment-note">${escapeHtml(p.note)}</p>`:''}</div>`;
}
function initConfirmStep(){
  if(!document.getElementById('view-confirm-step')) return;
  const d=ensureCheckoutOrBack(true); if(!d) return;
  currentOrderType=d.type; selectedPkg=Number(d.robux); selectedPrice=Number(d.price); uploadedProof=d.proof;
  const box=document.getElementById('confirmDetailBox');
  const payment=findPaymentById(d.payment_id) || {id:d.payment_id,name:d.payment_name,payment_type:d.payment_type,account_name:d.payment_account_name,account_number:d.payment_account_number,qris_image:d.payment_qris_image,note:d.payment_note};
  if(box){
    box.innerHTML=`
      <div class="confirm-row"><span>Layanan</span><b>${escapeHtml(d.type_label||d.type)}</b></div>
      <div class="confirm-row"><span>Nominal Robux</span><b>${Number(d.robux).toLocaleString('id-ID')} Robux</b></div>
      <div class="confirm-row"><span>Estimasi Kirim</span><b>${escapeHtml(d.delivery||'-')}</b></div>
      <div class="confirm-row roblox-confirm-row"><span>Username Roblox</span><b>${d.roblox_avatar_url?`<img src="${escapeHtml(d.roblox_avatar_url)}" alt="Avatar Roblox" class="confirm-roblox-avatar">`:''}${escapeHtml(d.username)}</b></div>
      <div class="confirm-row"><span>Username Discord</span><b>${escapeHtml(d.discord)}</b></div>
      <div class="confirm-row"><span>Metode Pembayaran</span><b>${escapeHtml(payment.name||'-')} · ${paymentTypeLabel(payment.payment_type||'bank')}</b></div>
      ${payment.account_name?`<div class="confirm-row"><span>Atas Nama</span><b>${escapeHtml(payment.account_name)}</b></div>`:''}
      ${payment.account_number?`<div class="confirm-row"><span>${(payment.payment_type||'bank')==='wallet'?'Nomor HP':'Nomor Rekening'}</span><b class="mono">${escapeHtml(payment.account_number)}</b></div>`:''}
      ${payment.note?`<div class="confirm-row"><span>Catatan Pembayaran</span><b>${escapeHtml(payment.note)}</b></div>`:''}
      <div class="confirm-row total"><span>Total Bayar</span><b>${rupiah(Number(d.price))}</b></div>
      ${(payment.payment_type||'bank')==='qris' && payment.qris_image ? `<div class="confirm-proof"><span>QRIS Dipilih</span><img src="${escapeHtml(payment.qris_image)}" alt="QRIS"></div>` : ''}
      <div class="confirm-proof"><span>Bukti Pembayaran</span><img src="${escapeHtml(d.proof)}" alt="Bukti pembayaran"></div>`;
  }
  const pbox=document.getElementById('confirmPaymentBox'); if(pbox) pbox.innerHTML=paymentPreviewHtml(payment);
}
async function submitConfirmedOrder(ev){
  const err=document.getElementById('confirmFormErr'); if(err)err.style.display='none';
  const d=ensureCheckoutOrBack(true); if(!d) return;
  const submitBtn=(ev&&ev.currentTarget)||document.querySelector('.order-submit-btn'); const oldText=submitBtn?.innerHTML;
  const finish=()=>{ if(submitBtn){submitBtn.disabled=false; submitBtn.classList.remove('is-loading'); submitBtn.innerHTML=oldText;} };
  if(submitBtn){submitBtn.disabled=true; submitBtn.classList.add('is-loading'); submitBtn.innerHTML='<span class="mini-spinner"></span><span class="btn-label">Memproses order...</span>';}
  try{
    const data=await api('/orders',{method:'POST',body:JSON.stringify({type:d.type,robux:Number(d.robux),username:d.username,discord:d.discord,proof:d.proof,roblox_user_id:d.roblox_user_id||'',roblox_avatar_url:d.roblox_avatar_url||''})});
    clearCheckoutDraft();
    setTimeout(()=>window.location.assign('/order-success.html?code='+encodeURIComponent(data.code)),450);
  }catch(e){ showFormErr(err,e.message); finish(); }
}

// Matikan submitOrder lama di halaman order. Submit final hanya di konfirmasi order.
async function submitOrder(ev){ return submitConfirmedOrder(ev); }

document.addEventListener('DOMContentLoaded',()=>{
  initPaymentStep();
  initConfirmStep();
});

window.saveCheckoutDetail=saveCheckoutDetail;
window.backToDetailOrder=backToDetailOrder;
window.backToPaymentStep=backToPaymentStep;
window.saveSelectedPaymentDraft=saveSelectedPaymentDraft;
window.saveProofDraft=saveProofDraft;
window.savePaymentStep=savePaymentStep;
window.submitConfirmedOrder=submitConfirmedOrder;
