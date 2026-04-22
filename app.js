// ─────────────────────────────────────────────
//  app.js  –  Sep Cafe POS · Main logic
// ─────────────────────────────────────────────

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let stockQty       = {};   // {name: number|null}  null=unlimited
let order          = [];
let orderHistory   = [];
let orderCounter   = 1;
let salesData      = {};   // {name:{count,revenue,cat}}
let customMenuItems = [];  // items added/edited via DB (overrides MENU)
let currentCat     = "All";
let currentStockCat= "All";
let mgmtCat        = "All";
let mgmtShowInactive = false;
let searchQ        = "";
let dbMode         = false;

/* ══════════════════════════════════════════
   LOCAL STORAGE
══════════════════════════════════════════ */
const LS = {
  qty:"sc_stockqty", order:"sc_order", history:"sc_history",
  counter:"sc_counter", sales:"sc_sales", customMenu:"sc_custommenu"
};
function lsSave() {
  try {
    localStorage.setItem(LS.qty,        JSON.stringify(stockQty));
    localStorage.setItem(LS.order,      JSON.stringify(order));
    localStorage.setItem(LS.history,    JSON.stringify(orderHistory));
    localStorage.setItem(LS.counter,    String(orderCounter));
    localStorage.setItem(LS.sales,      JSON.stringify(salesData));
    localStorage.setItem(LS.customMenu, JSON.stringify(customMenuItems));
  } catch(e) {}
}
function lsLoad() {
  try {
    const q=localStorage.getItem(LS.qty),   o=localStorage.getItem(LS.order),
          h=localStorage.getItem(LS.history),c=localStorage.getItem(LS.counter),
          s=localStorage.getItem(LS.sales),  m=localStorage.getItem(LS.customMenu);
    if(q) stockQty      =JSON.parse(q);
    if(o) order         =JSON.parse(o);
    if(h) orderHistory  =JSON.parse(h);
    if(c) orderCounter  =parseInt(c,10);
    if(s) salesData     =JSON.parse(s);
    if(m) customMenuItems=JSON.parse(m);
  } catch(e) {}
}

/* ══════════════════════════════════════════
   MERGED MENU  (base MENU.js + DB overrides)
   DB items take priority; same name = override
══════════════════════════════════════════ */
function allItems() {
  // Start with base menu
  const base = [];
  Object.entries(MENU).forEach(([cat, { trackQty, items }]) =>
    items.forEach(i => base.push({ ...i, cat, trackQty, source:"base" }))
  );

  // Merge custom/DB items
  const dbMap = {};
  customMenuItems.forEach(i => { if(i.active !== false) dbMap[i.name] = i; });

  // Override matching base items, add new ones
  const merged = base.map(b => dbMap[b.n]
    ? { n:dbMap[b.n].name, p:parseFloat(dbMap[b.n].price),
        cat:dbMap[b.n].category, trackQty:dbMap[b.n].track_qty,
        source:"db", id:dbMap[b.n].id }
    : b
  );
  // Add DB-only items (not in base)
  const baseNames = new Set(base.map(b => b.n));
  customMenuItems.forEach(i => {
    if(i.active !== false && !baseNames.has(i.name)) {
      merged.push({
        n:i.name, p:parseFloat(i.price), cat:i.category,
        trackQty:i.track_qty, source:"db", id:i.id
      });
    }
  });

  return merged;
}

// All known categories (base + DB)
function allCategories() {
  const cats = new Set(Object.keys(MENU));
  customMenuItems.forEach(i => cats.add(i.category));
  return [...cats];
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
async function init() {
  lsLoad();

  allItems().forEach(i => {
    if (stockQty[i.n] === undefined) stockQty[i.n] = null;
  });

  if (DB_READY) {
    dbMode = true;
    updateSyncBadge(true);
    try {
      const [cloudStock, cloudSales, cloudOrders, cloudMenu] = await Promise.all([
        dbLoadStock(), dbLoadSales(), dbLoadOrders(), dbLoadAllMenuItems()
      ]);
      if (cloudStock)  Object.assign(stockQty, cloudStock);
      if (cloudSales)  salesData       = cloudSales;
      if (cloudOrders) { orderHistory  = cloudOrders; orderCounter = (cloudOrders[0]?.id||0)+1; }
      if (cloudMenu)   { customMenuItems = cloudMenu; }
      // init stock for any new items
      allItems().forEach(i => { if(stockQty[i.n]===undefined) stockQty[i.n]=null; });
      lsSave();
      showToast("Cloud sync connected ☁");
    } catch(e) {
      console.warn("Cloud sync failed:", e);
      updateSyncBadge(false);
    }
  } else {
    updateSyncBadge(false);
  }

  buildCatTabs();
  renderItems();
  renderOrder();
}

function updateSyncBadge(online) {
  const el = document.getElementById("sync-badge");
  if (!el) return;
  el.className = "sync-badge " + (online ? "online" : "offline");
  el.innerHTML = `<span class="sync-dot"></span>${online ? "Cloud sync" : "Local only"}`;
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function esc(s) { return String(s).replace(/'/g,"\\'"); }
function isAvailable(n){ const q=stockQty[n]; return q===null||q>0; }
function isLow(n)      { const q=stockQty[n]; return q!==null&&q>0&&q<=3; }
function isEmpty(n)    { const q=stockQty[n]; return q!==null&&q<=0; }

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */
function showToast(msg, dur=2200) {
  const el=document.getElementById("toast");
  el.textContent=msg; el.classList.add("show");
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.classList.remove("show"),dur);
}

/* ══════════════════════════════════════════
   MODAL SYSTEM
══════════════════════════════════════════ */
let _modalResolve = null;

function showModal(cfg) {
  return new Promise(resolve => {
    _modalResolve = resolve;
    document.getElementById("modal-icon").innerHTML  = cfg.icon||"📋";
    document.getElementById("modal-icon").className  = `modal-icon ${cfg.iconColor||"green"}`;
    document.getElementById("modal-title").textContent= cfg.title||"";
    document.getElementById("modal-sub").textContent  = cfg.subtitle||"";
    document.getElementById("modal-body").innerHTML   = cfg.body||"";

    const iw = document.getElementById("modal-input-wrap");
    if (cfg.input) {
      iw.style.display="block";
      const inp=document.getElementById("modal-input");
      inp.placeholder=cfg.input.placeholder||"";
      inp.value=cfg.input.default||"";
      inp.type=cfg.input.type||"text";
      inp.min=cfg.input.min??"";
    } else { iw.style.display="none"; }

    const footer=document.getElementById("modal-footer");
    footer.innerHTML="";
    (cfg.buttons||[{label:"OK",value:true,style:"primary"}]).forEach(btn=>{
      const b=document.createElement("button");
      b.className=`btn ${btn.style||""}`;
      b.textContent=btn.label;
      b.onclick=()=>{
        const inputVal=cfg.input?document.getElementById("modal-input").value:null;
        closeModal();
        resolve({action:btn.value, input:inputVal});
      };
      footer.appendChild(b);
    });
    document.getElementById("modal-overlay").classList.add("visible");
    if(cfg.input) setTimeout(()=>document.getElementById("modal-input").focus(),120);
  });
}
function closeModal() {
  document.getElementById("modal-overlay").classList.remove("visible");
}

/* ══════════════════════════════════════════
   SHEET
══════════════════════════════════════════ */
function openSheet() {
  document.getElementById("sheet-overlay").classList.add("open");
  document.getElementById("bottom-sheet").classList.add("open");
  document.body.style.overflow="hidden";
}
function closeSheet() {
  document.getElementById("sheet-overlay").classList.remove("open");
  document.getElementById("bottom-sheet").classList.remove("open");
  document.body.style.overflow="";
}

/* ══════════════════════════════════════════
   TAB SWITCHING
══════════════════════════════════════════ */
const TAB_ORDER = ["orders","stock","log","analytics","menu-mgmt"];

function switchTab(t) {
  TAB_ORDER.forEach(x=>{
    document.getElementById(x+"-panel").classList.toggle("active",x===t);
  });
  document.querySelectorAll(".topbar-tabs .tab").forEach((el,i)=>{
    el.classList.toggle("active",TAB_ORDER[i]===t);
  });
  document.querySelectorAll(".bnav-btn").forEach((el,i)=>{
    el.classList.toggle("active",TAB_ORDER[i]===t);
  });
  if(t==="stock")     renderStock();
  if(t==="log")       renderLog();
  if(t==="analytics") renderAnalytics();
  if(t==="menu-mgmt") renderMenuMgmt();
  closeSheet();
}

/* ══════════════════════════════════════════
   CATEGORY TABS
══════════════════════════════════════════ */
function buildCatTabs() {
  const cats=["All",...new Set(allItems().map(i=>i.cat))];
  document.getElementById("cat-tabs").innerHTML=cats.map(c=>
    `<button class="cat-btn${c===currentCat?" active":""}" onclick="setCat('${esc(c)}')">${c}</button>`
  ).join("");
}
function setCat(c){ currentCat=c; buildCatTabs(); renderItems(); }

/* ══════════════════════════════════════════
   ITEM GRID
══════════════════════════════════════════ */
function filterItems(q){ searchQ=q; renderItems(); }

function renderItems() {
  const items=allItems().filter(i=>{
    const catOk=currentCat==="All"||i.cat===currentCat;
    const qOk=!searchQ||i.n.toLowerCase().includes(searchQ.toLowerCase());
    return catOk&&qOk;
  });

  const html=items.length ? items.map(i=>{
    const avail=isAvailable(i.n), low=isLow(i.n), empty=isEmpty(i.n);
    const q=stockQty[i.n];
    let badge="";
    if(empty) badge='<span class="item-badge out">OUT</span>';
    else if(low) badge='<span class="item-badge low">LOW</span>';
    let cls="item-card";
    if(empty) cls+=" out-of-stock"; else if(low) cls+=" low-stock";
    let stockPill="";
    if(i.trackQty&&q!==null){
      const pc=empty?"empty":low?"low":"ok";
      stockPill=`<div class="item-stock-pill ${pc}">${empty?"Out of stock":q+" left"}</div>`;
    }
    return `<div class="${cls}" onclick="${avail?`addItem('${esc(i.n)}',${i.p})`:""}">
      ${badge}
      <div class="item-name">${i.n}</div>
      <div class="item-price">${i.p.toFixed(3)} OMR</div>
      ${stockPill}
      <div class="item-cat-tag">${i.cat}</div>
    </div>`;
  }).join("")
  : `<div style="grid-column:1/-1;text-align:center;padding:50px 20px;color:var(--tm);font-size:13px">No items found</div>`;

  document.getElementById("item-grid").innerHTML=html;
}

/* ══════════════════════════════════════════
   ORDER
══════════════════════════════════════════ */
function addItem(name,price){
  const q=stockQty[name];
  if(q!==null&&q<=0){showToast("Out of stock: "+name);return;}
  const ex=order.find(o=>o.n===name);
  if(q!==null&&(ex?ex.qty:0)>=q){showToast(`Only ${q} left in stock`);return;}
  if(ex) ex.qty++; else order.push({n:name,p:price,qty:1});
  lsSave(); renderOrder(); showToast("Added: "+name);
}
function changeQty(name,d){
  const ex=order.find(o=>o.n===name); if(!ex) return;
  if(d>0){const q=stockQty[name];if(q!==null&&ex.qty>=q){showToast(`Only ${q} in stock`);return;}}
  ex.qty+=d;
  if(ex.qty<=0) order=order.filter(o=>o.n!==name);
  lsSave(); renderOrder();
}
function clearOrder(){ order=[]; lsSave(); renderOrder(); closeSheet(); }

function orderRowsHTML(){
  return order.map(o=>`
    <div class="order-row">
      <span class="order-row-name">${o.n}</span>
      <div class="qty-ctrl">
        <button class="qty-btn" onclick="changeQty('${esc(o.n)}',-1)">−</button>
        <span class="qty-num">${o.qty}</span>
        <button class="qty-btn" onclick="changeQty('${esc(o.n)}',1)">+</button>
      </div>
      <span class="row-price">${(o.p*o.qty).toFixed(3)}</span>
    </div>`).join("");
}
function orderFooterHTML(suffix){
  const total=order.reduce((s,o)=>s+o.p*o.qty,0);
  return `<div class="order-footer">
    <div class="total-line"><span class="total-label">Total</span><span class="total-amount">${total.toFixed(3)} OMR</span></div>
    <textarea class="note-input" id="order-note-${suffix}" rows="2" placeholder="Note: no sugar, take away, table #…"></textarea>
    <button class="place-btn" onclick="placeOrder('${suffix}')">Place Order</button>
  </div>`;
}
function updateCartBadge(){
  const total=order.reduce((s,o)=>s+o.qty,0);
  const el=document.getElementById("cart-count");
  if(!el) return;
  el.textContent=total;
  el.classList.toggle("hidden",total===0);
}
function renderOrder(){
  updateCartBadge();
  const empty=`<div class="order-empty"><div class="order-empty-icon">☕</div><span>Tap items to add</span></div>`;
  const dl=document.getElementById("order-list-desktop"),df=document.getElementById("order-footer-desktop");
  if(dl) dl.innerHTML=order.length?orderRowsHTML():empty;
  if(df) df.innerHTML=order.length?orderFooterHTML("desktop"):"";
  const ml=document.getElementById("order-list-mobile"),mf=document.getElementById("order-footer-mobile");
  if(ml) ml.innerHTML=order.length?orderRowsHTML():empty;
  if(mf) mf.innerHTML=order.length?orderFooterHTML("mobile"):"";
}

async function placeOrder(suffix){
  if(!order.length) return;
  const noteEl=document.getElementById("order-note-"+suffix);
  const note=noteEl?noteEl.value.trim():"";
  const total=order.reduce((s,o)=>s+o.p*o.qty,0);
  const now=new Date();
  const placed={
    id:orderCounter++, items:[...order], total,
    time:now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
    date:now.toLocaleDateString([],{day:"2-digit",month:"short"}),
    note
  };
  order.forEach(oi=>{
    if(stockQty[oi.n]!==null) stockQty[oi.n]=Math.max(0,(stockQty[oi.n]||0)-oi.qty);
  });
  order.forEach(oi=>{
    const cat=allItems().find(x=>x.n===oi.n)?.cat||"Other";
    if(!salesData[oi.n]) salesData[oi.n]={count:0,revenue:0,cat};
    salesData[oi.n].count+=oi.qty;
    salesData[oi.n].revenue+=oi.p*oi.qty;
  });
  orderHistory.unshift(placed);
  order=[]; lsSave();
  if(dbMode){
    Promise.all([
      dbSaveOrder(placed),
      dbSetStockBatch(Object.entries(stockQty).filter(([,v])=>v!==null)),
      dbUpsertSales(Object.entries(salesData).map(([name,d])=>({name,count:d.count,revenue:d.revenue,cat:d.cat})))
    ]).catch(e=>console.warn("Cloud save:",e));
  }
  renderOrder(); renderItems(); closeSheet();
  showToast(`Order #${placed.id} placed!`);
  showReceiptModal(placed);
}

/* ══════════════════════════════════════════
   RECEIPT
══════════════════════════════════════════ */
function buildReceiptBodyHTML(ord){
  const rows=ord.items.map(i=>`<div class="receipt-row"><span>${i.qty}× ${i.n}</span><span>${(i.p*i.qty).toFixed(3)}</span></div>`).join("");
  return `<div class="receipt-card">
    <div class="receipt-logo">SEP CAFE</div>
    <div class="receipt-sub">@sep.cafe_oman</div>
    <div class="receipt-sub">${ord.date||""} · ${ord.time}</div>
    <hr class="receipt-divider"/>
    <div class="receipt-row"><span><strong>Order #${ord.id}</strong></span></div>
    ${rows}
    <hr class="receipt-divider"/>
    <div class="receipt-row total"><span>TOTAL</span><span>${ord.total.toFixed(3)} OMR</span></div>
    ${ord.note?`<div class="receipt-row"><span style="font-style:italic;color:#777">📝 ${ord.note}</span></div>`:""}
    <hr class="receipt-divider"/>
    <div class="receipt-footer">Thank you for visiting! ☕<br>Come back soon</div>
  </div>`;
}
async function showReceiptModal(ord){
  const res=await showModal({icon:"🧾",iconColor:"green",title:`Order #${ord.id} placed`,subtitle:`${ord.date} · ${ord.time} · ${ord.total.toFixed(3)} OMR`,body:buildReceiptBodyHTML(ord),buttons:[{label:"Print",value:"print",style:"primary"},{label:"Close",value:"close",style:""}]});
  if(res.action==="print") doPrint(ord);
}
async function showReceiptModalById(ordStr){
  const ord=JSON.parse(ordStr.replace(/&quot;/g,'"'));
  const res=await showModal({icon:"🧾",iconColor:"green",title:`Order #${ord.id}`,subtitle:`${ord.date||""} · ${ord.time} · ${ord.total.toFixed(3)} OMR`,body:buildReceiptBodyHTML(ord),buttons:[{label:"Print",value:"print",style:"primary"},{label:"Close",value:"close",style:""}]});
  if(res.action==="print") doPrint(ord);
}
function doPrint(ord){
  const el=document.getElementById("print-content");
  el.innerHTML=`<div style="font-family:'Courier New',monospace;font-size:13px;padding:20px;max-width:320px;margin:0 auto">
    <div style="text-align:center;font-size:20px;font-weight:700;letter-spacing:.1em">SEP CAFE</div>
    <div style="text-align:center;font-size:11px;color:#666;margin-bottom:6px">@sep.cafe_oman · ${ord.date||""} ${ord.time}</div>
    <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
    <div style="font-weight:700">Order #${ord.id}</div>
    ${ord.items.map(i=>`<div style="display:flex;justify-content:space-between;margin:3px 0"><span>${i.qty}× ${i.n}</span><span>${(i.p*i.qty).toFixed(3)}</span></div>`).join("")}
    <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px"><span>TOTAL</span><span>${ord.total.toFixed(3)} OMR</span></div>
    ${ord.note?`<div style="font-style:italic;color:#777;margin-top:6px">Note: ${ord.note}</div>`:""}
    <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
    <div style="text-align:center;font-size:11px;color:#888">Thank you for visiting! ☕</div>
  </div>`;
  setTimeout(()=>window.print(),80);
}
async function printCurrentOrder(){
  if(!order.length){showToast("No items in order");return;}
  const total=order.reduce((s,o)=>s+o.p*o.qty,0);
  const now=new Date();
  const fake={id:"—",items:[...order],total,time:now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),date:now.toLocaleDateString([],{day:"2-digit",month:"short"}),note:document.getElementById("order-note-desktop")?.value||""};
  const res=await showModal({icon:"🖨️",iconColor:"blue",title:"Print current order",subtitle:`${total.toFixed(3)} OMR`,body:buildReceiptBodyHTML(fake),buttons:[{label:"Print",value:"print",style:"primary"},{label:"Cancel",value:"cancel",style:""}]});
  if(res.action==="print") doPrint(fake);
}

/* ══════════════════════════════════════════
   STOCK PANEL
══════════════════════════════════════════ */
function buildStockCatTabs(){
  const cats=["All",...Object.keys(MENU)];
  document.getElementById("stock-cat-tabs").innerHTML=cats.map(c=>
    `<button class="cat-btn${c===currentStockCat?" active":""}" onclick="setStockCat('${esc(c)}')">${c}</button>`
  ).join("");
}
function setStockCat(c){ currentStockCat=c; renderStock(); }
function renderStock(){
  buildStockCatTabs();
  const items=allItems().filter(i=>currentStockCat==="All"||i.cat===currentStockCat);
  document.getElementById("stock-grid").innerHTML=items.map(i=>{
    const q=stockQty[i.n],tracks=i.trackQty;
    const empty=tracks&&q!==null&&q<=0, low=tracks&&q!==null&&q>0&&q<=3;
    let cls="stock-item"; if(low) cls+=" low"; if(empty) cls+=" empty";
    let status="",right="";
    if(!tracks){ status=`<span class="stock-status-pill ok">Unlimited</span>`; right=`<span style="font-size:11px;color:var(--tm);font-style:italic">Drink — no tracking</span>`; }
    else if(q===null){ status=`<span class="stock-status-pill ok">Not set</span>`; right=`<button class="sq-btn" onclick="adjustStock('${esc(i.n)}',-1)">−</button><span class="sq-num">—</span><button class="sq-btn" onclick="adjustStock('${esc(i.n)}',1)">+</button><button class="sq-btn" style="font-size:11px;width:auto;padding:0 8px;border-radius:6px" onclick="setStockModal('${esc(i.n)}')">✎</button>`; }
    else if(empty){ status=`<span class="stock-status-pill empty">Out of stock</span>`; right=`<button class="sq-btn" onclick="adjustStock('${esc(i.n)}',-1)">−</button><span class="sq-num">${q}</span><button class="sq-btn" onclick="adjustStock('${esc(i.n)}',1)">+</button><button class="sq-btn" style="font-size:11px;width:auto;padding:0 8px;border-radius:6px" onclick="setStockModal('${esc(i.n)}')">✎</button>`; }
    else if(low){ status=`<span class="stock-status-pill low">${q} remaining — LOW</span>`; right=`<button class="sq-btn" onclick="adjustStock('${esc(i.n)}',-1)">−</button><span class="sq-num">${q}</span><button class="sq-btn" onclick="adjustStock('${esc(i.n)}',1)">+</button><button class="sq-btn" style="font-size:11px;width:auto;padding:0 8px;border-radius:6px" onclick="setStockModal('${esc(i.n)}')">✎</button>`; }
    else{ status=`<span class="stock-status-pill ok">${q} remaining</span>`; right=`<button class="sq-btn" onclick="adjustStock('${esc(i.n)}',-1)">−</button><span class="sq-num">${q}</span><button class="sq-btn" onclick="adjustStock('${esc(i.n)}',1)">+</button><button class="sq-btn" style="font-size:11px;width:auto;padding:0 8px;border-radius:6px" onclick="setStockModal('${esc(i.n)}')">✎</button>`; }
    return `<div class="${cls}"><div class="stock-left"><div class="stock-name">${i.n}</div><div class="stock-price">${i.p.toFixed(3)} OMR</div>${status}</div><div class="stock-right">${right}</div></div>`;
  }).join("");
}
function adjustStock(name,d){
  if(stockQty[name]===null) stockQty[name]=0;
  stockQty[name]=Math.max(0,stockQty[name]+d);
  lsSave(); if(dbMode) dbSetStock(name,stockQty[name]).catch(()=>{});
  renderStock(); renderItems();
}
async function setStockModal(name){
  const res=await showModal({icon:"🍰",iconColor:"amber",title:"Set stock quantity",subtitle:name,body:`<p>Enter how many you have for this shift.</p>`,input:{placeholder:"e.g. 5",default:stockQty[name]!==null?String(stockQty[name]):"",type:"number",min:0},buttons:[{label:"Save",value:"save",style:"primary"},{label:"Cancel",value:"cancel",style:""}]});
  if(res.action!=="save") return;
  const n=parseInt(res.input,10);
  if(isNaN(n)||n<0){showToast("Invalid number");return;}
  stockQty[name]=n; lsSave();
  if(dbMode) dbSetStock(name,n).catch(()=>{});
  renderStock(); renderItems(); showToast(`${name}: ${n} in stock`);
}
async function confirmResetShift(){
  const res=await showModal({icon:"↺",iconColor:"amber",title:"Reset shift stock?",subtitle:"Start of new shift",body:`<p>Sets all Sweets back to "not set" so you can enter fresh quantities.</p><p>Order history and analytics are <strong>not</strong> affected.</p>`,buttons:[{label:"Reset stock",value:"yes",style:"danger"},{label:"Cancel",value:"no",style:""}]});
  if(res.action!=="yes") return;
  allItems().filter(i=>i.trackQty).forEach(i=>stockQty[i.n]=null);
  lsSave(); renderStock(); renderItems(); showToast("Sweets stock reset");
}

/* ══════════════════════════════════════════
   LOG PANEL
══════════════════════════════════════════ */
function renderLog(){
  const totalRev=orderHistory.reduce((s,o)=>s+o.total,0);
  const totalItems=orderHistory.reduce((s,o)=>s+o.items.reduce((a,i)=>a+i.qty,0),0);
  document.getElementById("stats-row").innerHTML=`
    <div class="stat-card"><div class="stat-val">${orderHistory.length}</div><div class="stat-label">Orders</div></div>
    <div class="stat-card"><div class="stat-val">${totalItems}</div><div class="stat-label">Items served</div></div>
    <div class="stat-card"><div class="stat-val">${totalRev.toFixed(3)}</div><div class="stat-label">Revenue (OMR)</div></div>`;
  const logEl=document.getElementById("log-grid");
  if(!orderHistory.length){logEl.innerHTML=`<div class="log-empty">No orders yet this session</div>`;return;}
  logEl.innerHTML=orderHistory.map(o=>`
    <div class="log-card">
      <div class="log-top">
        <span class="log-num">Order #${o.id}</span>
        <div class="log-meta">
          <span class="log-time">${o.date||""} ${o.time}</span>
          <button class="action-btn" style="padding:4px 10px;font-size:11px" onclick='showReceiptModalById(${JSON.stringify(JSON.stringify(o))})'>
            <svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
        </div>
      </div>
      <div class="log-items">${o.items.map(i=>`<strong>${i.qty}×</strong> ${i.n}`).join(" · ")}</div>
      <div class="log-bottom">
        <span class="log-total">${o.total.toFixed(3)} OMR</span>
        ${o.note?`<span class="log-note">${o.note}</span>`:""}
      </div>
    </div>`).join("");
}
async function endShift(){
  const res=await showModal({icon:"📊",iconColor:"green",title:"End shift",subtitle:"Print shift summary?",body:buildShiftSummaryHTML(),buttons:[{label:"Print summary",value:"print",style:"primary"},{label:"Close",value:"close",style:""}]});
  if(res.action==="print") doPrintShiftSummary();
}
function buildShiftSummaryHTML(){
  const totalRev=orderHistory.reduce((s,o)=>s+o.total,0);
  const totalItems=orderHistory.reduce((s,o)=>s+o.items.reduce((a,i)=>a+i.qty,0),0);
  const top5=Object.entries(salesData).sort((a,b)=>b[1].count-a[1].count).slice(0,5);
  const sweetStock=allItems().filter(i=>i.trackQty&&stockQty[i.n]!==null);
  return `<div class="detail-list">
    <div class="detail-row"><span>Orders</span><span>${orderHistory.length}</span></div>
    <div class="detail-row"><span>Items served</span><span>${totalItems}</span></div>
    <div class="detail-row bold"><span>Revenue</span><span>${totalRev.toFixed(3)} OMR</span></div>
  </div>
  ${top5.length?`<p style="margin-top:12px;font-weight:600;font-size:13px">Top sellers</p><div class="detail-list" style="margin-top:6px">${top5.map(([n,d],i)=>`<div class="detail-row"><span>${i+1}. ${n}</span><span>${d.count} sold</span></div>`).join("")}</div>`:""}
  ${sweetStock.length?`<p style="margin-top:12px;font-weight:600;font-size:13px">Remaining sweets stock</p><div class="detail-list" style="margin-top:6px">${sweetStock.map(i=>`<div class="detail-row"><span>${i.n}</span><span>${stockQty[i.n]} left</span></div>`).join("")}</div>`:""}`;
}
function doPrintShiftSummary(){
  const totalRev=orderHistory.reduce((s,o)=>s+o.total,0),totalItems=orderHistory.reduce((s,o)=>s+o.items.reduce((a,i)=>a+i.qty,0),0);
  const top5=Object.entries(salesData).sort((a,b)=>b[1].count-a[1].count).slice(0,5);
  const sweetStock=allItems().filter(i=>i.trackQty&&stockQty[i.n]!==null);
  const el=document.getElementById("print-content");
  el.innerHTML=`<div style="font-family:'Courier New',monospace;font-size:12px;padding:20px;max-width:320px;margin:0 auto">
    <div style="text-align:center;font-size:18px;font-weight:700">SEP CAFE — SHIFT SUMMARY</div>
    <div style="text-align:center;font-size:10px;color:#666">${new Date().toLocaleString()}</div>
    <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
    <div style="display:flex;justify-content:space-between"><span>Orders</span><span>${orderHistory.length}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Items served</span><span>${totalItems}</span></div>
    <div style="display:flex;justify-content:space-between;font-weight:700"><span>Revenue</span><span>${totalRev.toFixed(3)} OMR</span></div>
    <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
    <div style="font-weight:700">Top Sellers</div>
    ${top5.map(([n,d],i)=>`<div style="display:flex;justify-content:space-between"><span>${i+1}. ${n}</span><span>${d.count} sold</span></div>`).join("")}
    ${sweetStock.length?`<div style="border-top:1px dashed #bbb;margin:8px 0"></div><div style="font-weight:700">Remaining Sweets</div>${sweetStock.map(i=>`<div style="display:flex;justify-content:space-between"><span>${i.n}</span><span>${stockQty[i.n]} left</span></div>`).join("")}`:""}
    <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
    <div style="text-align:center;font-size:10px;color:#888">End of Shift · Sep Cafe</div>
  </div>`;
  setTimeout(()=>window.print(),80);
}

/* ══════════════════════════════════════════
   ANALYTICS PANEL
══════════════════════════════════════════ */
function renderAnalytics(){
  const el=document.getElementById("analytics-content");
  const entries=Object.entries(salesData).sort((a,b)=>b[1].count-a[1].count);
  if(!entries.length){el.innerHTML=`<div class="analytics-empty">No sales data yet.<br>Start taking orders to see analytics here.</div>`;return;}
  const maxCount=entries[0][1].count,totalSold=entries.reduce((s,[,d])=>s+d.count,0),totalRev=entries.reduce((s,[,d])=>s+d.revenue,0);
  const catMap={};
  entries.forEach(([,d])=>{const c=d.cat||"Other";if(!catMap[c])catMap[c]={count:0,revenue:0};catMap[c].count+=d.count;catMap[c].revenue+=d.revenue;});
  const catCards=Object.entries(catMap).sort((a,b)=>b[1].count-a[1].count).map(([c,d])=>`<div class="cat-stat-card"><div class="cat-stat-name">${c}</div><div class="cat-stat-val">${d.count}</div><div class="cat-stat-sub">${d.revenue.toFixed(3)} OMR</div></div>`).join("");
  const top10=entries.slice(0,10);
  const rankRows=top10.map(([name,d],i)=>{
    const pct=maxCount>0?Math.round((d.count/maxCount)*100):0;
    let cls="rest"; if(i===0)cls="gold";else if(i===1)cls="silver";else if(i===2)cls="bronze";
    return `<div class="rank-row"><div class="rank-pos ${cls}">${i+1}</div><div class="rank-name">${name}<br><span class="rank-cat">${d.cat}</span></div><div class="rank-bar-wrap"><div class="rank-bar ${i===0?"top":""}" style="width:${pct}%"></div></div><div class="rank-count">${d.count}</div><div class="rank-rev">${d.revenue.toFixed(3)}</div></div>`;
  }).join("");
  const slow=entries.length>5?entries.slice(-5).reverse():[];
  const slowRows=slow.map(([name,d])=>`<div class="rank-row"><div class="rank-pos rest">—</div><div class="rank-name">${name}<br><span class="rank-cat">${d.cat}</span></div><div style="flex:1"></div><div class="rank-count">${d.count}</div><div class="rank-rev">${d.revenue.toFixed(3)}</div></div>`).join("");
  el.innerHTML=`
    <div class="stats-row" style="margin-bottom:14px">
      <div class="stat-card"><div class="stat-val">${totalSold}</div><div class="stat-label">Items sold</div></div>
      <div class="stat-card"><div class="stat-val">${totalRev.toFixed(3)}</div><div class="stat-label">Revenue (OMR)</div></div>
      <div class="stat-card"><div class="stat-val">${entries.length}</div><div class="stat-label">Unique items</div></div>
    </div>
    <div class="section-block"><div class="section-block-title">Sales by category</div><div class="cat-breakdown">${catCards}</div></div>
    <div class="section-block"><div class="section-block-title">🏆 Top sellers — qty · OMR</div>${rankRows}</div>
    ${slow.length?`<div class="section-block"><div class="section-block-title">📉 Slow movers — qty · OMR</div>${slowRows}</div>`:""}`;
}
async function clearAnalytics(){
  const res=await showModal({icon:"⚠️",iconColor:"red",title:"Clear all analytics data?",subtitle:"This cannot be undone",body:`<p>All sales history, order logs, and analytics will be permanently deleted.</p>`,buttons:[{label:"Delete everything",value:"yes",style:"danger"},{label:"Cancel",value:"no",style:""}]});
  if(res.action!=="yes") return;
  salesData={}; orderHistory=[]; orderCounter=1; lsSave();
  if(dbMode) Promise.all([dbClearOrders(),dbClearSales()]).catch(()=>{});
  renderAnalytics(); renderLog(); showToast("All data cleared");
}

/* ══════════════════════════════════════════
   MENU MANAGEMENT (CRUD)
══════════════════════════════════════════ */
function renderMenuMgmt() {
  const cats = ["All", ...allCategories()];

  // Category filter tabs
  document.getElementById("mgmt-cat-tabs").innerHTML = cats.map(c =>
    `<button class="cat-btn${c===mgmtCat?" active":""}" onclick="setMgmtCat('${esc(c)}')">${c}</button>`
  ).join("");

  // Toggle inactive
  document.getElementById("mgmt-show-inactive").checked = mgmtShowInactive;

  // Items to show
  let source = allItems();
  if (mgmtShowInactive) {
    // also include inactive DB items
    customMenuItems.filter(i=>i.active===false).forEach(i=>{
      if (!source.find(x=>x.n===i.name)) {
        source.push({n:i.name,p:parseFloat(i.price),cat:i.category,trackQty:i.track_qty,source:"db",id:i.id,inactive:true});
      }
    });
  }
  if (mgmtCat !== "All") source = source.filter(i=>i.cat===mgmtCat);

  // Group by category
  const grouped = {};
  source.forEach(i=>{
    if(!grouped[i.cat]) grouped[i.cat]=[];
    grouped[i.cat].push(i);
  });

  const html = Object.entries(grouped).map(([cat,items])=>`
    <div class="mgmt-cat-group">
      <div class="mgmt-cat-header">
        <span>${cat}</span>
        <span class="mgmt-cat-count">${items.filter(i=>!i.inactive).length} items</span>
      </div>
      ${items.map(item=>{
        const isDB  = item.source==="db";
        const isDead= item.inactive===true;
        return `<div class="mgmt-item-row${isDead?" mgmt-inactive":""}">
          <div class="mgmt-item-info">
            <span class="mgmt-item-name">${item.n}</span>
            <div class="mgmt-item-meta">
              <span class="mgmt-price-tag">${item.p.toFixed(3)} OMR</span>
              ${item.trackQty?'<span class="mgmt-pill qty-pill">Tracks stock</span>':""}
              ${isDB?'<span class="mgmt-pill db-pill">Cloud</span>':'<span class="mgmt-pill base-pill">Built-in</span>'}
              ${isDead?'<span class="mgmt-pill dead-pill">Hidden</span>':""}
            </div>
          </div>
          <div class="mgmt-item-actions">
            ${isDead
              ? `<button class="mgmt-btn restore" onclick="restoreMenuItem(${item.id})">Restore</button>
                 <button class="mgmt-btn del-hard" onclick="hardDeleteMenuItem(${item.id})">Delete</button>`
              : `<button class="mgmt-btn edit" onclick="openEditItem('${esc(item.n)}',${item.p},'${esc(item.cat)}',${item.trackQty},${isDB?item.id:"null"})">Edit</button>
                 ${isDB
                   ? `<button class="mgmt-btn del" onclick="deactivateMenuItem(${item.id},'${esc(item.n)}')">Hide</button>`
                   : `<button class="mgmt-btn del" onclick="overrideHideItem('${esc(item.n)}')">Hide</button>`
                 }`
            }
          </div>
        </div>`;
      }).join("")}
    </div>`).join("") || `<div class="analytics-empty">No items in this category</div>`;

  document.getElementById("mgmt-list").innerHTML = html;
}

function setMgmtCat(c){ mgmtCat=c; renderMenuMgmt(); }

function toggleInactive(el){ mgmtShowInactive=el.checked; renderMenuMgmt(); }

/* ── ADD NEW ITEM ── */
async function openAddItem() {
  // Step 1: basic info via custom form modal
  const cats = allCategories();
  const catOptions = cats.map(c=>`<option value="${c}">${c}</option>`).join("");
  const body = `
    <div class="mgmt-form">
      <div class="mgmt-field">
        <label>Item name</label>
        <input class="modal-input" id="mi-name" type="text" placeholder="e.g. Mango Cheesecake" style="margin-top:0"/>
      </div>
      <div class="mgmt-field">
        <label>Price (OMR)</label>
        <input class="modal-input" id="mi-price" type="number" step="0.001" min="0" placeholder="e.g. 1.500" style="margin-top:0"/>
      </div>
      <div class="mgmt-field">
        <label>Category</label>
        <select class="modal-input" id="mi-cat" style="margin-top:0">
          ${catOptions}
          <option value="__new__">+ New category…</option>
        </select>
      </div>
      <div class="mgmt-field">
        <label>New category name (if above = "New category")</label>
        <input class="modal-input" id="mi-newcat" type="text" placeholder="e.g. Sandwiches" style="margin-top:0"/>
      </div>
      <div class="mgmt-field mgmt-toggle-row">
        <label>Track stock quantity (Sweets only)</label>
        <input type="checkbox" id="mi-track" style="width:18px;height:18px;cursor:pointer"/>
      </div>
    </div>`;

  const res = await showModal({
    icon:"➕", iconColor:"green",
    title:"Add new item", subtitle:"Item will appear in the order menu immediately",
    body,
    buttons:[{label:"Add item",value:"add",style:"primary"},{label:"Cancel",value:"cancel",style:""}]
  });
  if(res.action!=="add") return;

  const name  = document.getElementById("mi-name").value.trim();
  const price = parseFloat(document.getElementById("mi-price").value);
  let   cat   = document.getElementById("mi-cat").value;
  const newCat= document.getElementById("mi-newcat").value.trim();
  const track = document.getElementById("mi-track").checked;

  if(!name){showToast("Item name is required");return;}
  if(isNaN(price)||price<0){showToast("Enter a valid price");return;}
  if(cat==="__new__"){
    if(!newCat){showToast("Enter a category name");return;}
    cat=newCat;
  }
  if(allItems().find(i=>i.n.toLowerCase()===name.toLowerCase())){
    showToast("An item with that name already exists");return;
  }

  const newItem = {name,price,category:cat,trackQty:track,sortOrder:99};
  if(dbMode){
    try{
      const [created]=await dbCreateMenuItem(newItem);
      customMenuItems.push(created);
      lsSave(); buildCatTabs(); renderItems(); renderMenuMgmt();
      showToast(`"${name}" added to menu`);
    }catch(e){ showToast("Cloud error: "+e.message); }
  } else {
    // Local only (no DB)
    customMenuItems.push({id:Date.now(),name,price,category:cat,track_qty:track,active:true,sort_order:99});
    lsSave(); buildCatTabs(); renderItems(); renderMenuMgmt();
    showToast(`"${name}" added (local only)`);
  }
}

/* ── EDIT ITEM ── */
async function openEditItem(name, price, cat, trackQty, dbId) {
  const cats = allCategories();
  const catOptions = cats.map(c=>`<option value="${c}"${c===cat?" selected":""}>${c}</option>`).join("");
  const body = `
    <div class="mgmt-form">
      <div class="mgmt-field">
        <label>Item name</label>
        <input class="modal-input" id="ei-name" type="text" value="${name}" style="margin-top:0"/>
      </div>
      <div class="mgmt-field">
        <label>Price (OMR)</label>
        <input class="modal-input" id="ei-price" type="number" step="0.001" min="0" value="${price.toFixed(3)}" style="margin-top:0"/>
      </div>
      <div class="mgmt-field">
        <label>Category</label>
        <select class="modal-input" id="ei-cat" style="margin-top:0">${catOptions}</select>
      </div>
      <div class="mgmt-field mgmt-toggle-row">
        <label>Track stock quantity</label>
        <input type="checkbox" id="ei-track" ${trackQty?"checked":""} style="width:18px;height:18px;cursor:pointer"/>
      </div>
      ${dbId===null?`<p style="font-size:12px;color:var(--amber);margin-top:8px">⚠️ This is a built-in item. Saving will create a cloud override that replaces it.</p>`:""}
    </div>`;

  const res = await showModal({
    icon:"✏️", iconColor:"amber",
    title:"Edit item", subtitle:name,
    body,
    buttons:[{label:"Save changes",value:"save",style:"primary"},{label:"Cancel",value:"cancel",style:""}]
  });
  if(res.action!=="save") return;

  const newName  = document.getElementById("ei-name").value.trim();
  const newPrice = parseFloat(document.getElementById("ei-price").value);
  const newCat   = document.getElementById("ei-cat").value;
  const newTrack = document.getElementById("ei-track").checked;

  if(!newName){showToast("Name is required");return;}
  if(isNaN(newPrice)||newPrice<0){showToast("Enter a valid price");return;}

  if(dbMode){
    try{
      if(dbId!==null){
        // Update existing DB item
        await dbUpdateMenuItem(dbId,{name:newName,price:newPrice,category:newCat,track_qty:newTrack});
        const idx=customMenuItems.findIndex(i=>i.id===dbId);
        if(idx>-1) customMenuItems[idx]={...customMenuItems[idx],name:newName,price:newPrice,category:newCat,track_qty:newTrack};
      } else {
        // Create override for built-in item
        const [created]=await dbCreateMenuItem({name:newName,price:newPrice,category:newCat,trackQty:newTrack});
        customMenuItems.push(created);
      }
      lsSave(); buildCatTabs(); renderItems(); renderStock(); renderMenuMgmt();
      showToast(`"${newName}" updated`);
    }catch(e){ showToast("Cloud error: "+e.message); }
  } else {
    const idx=customMenuItems.findIndex(i=>i.name===name);
    if(idx>-1) customMenuItems[idx]={...customMenuItems[idx],name:newName,price:newPrice,category:newCat,track_qty:newTrack};
    else customMenuItems.push({id:Date.now(),name:newName,price:newPrice,category:newCat,track_qty:newTrack,active:true,sort_order:99});
    lsSave(); buildCatTabs(); renderItems(); renderMenuMgmt();
    showToast(`"${newName}" updated (local only)`);
  }
}

/* ── HIDE (soft delete) ── */
async function deactivateMenuItem(dbId, name){
  const res=await showModal({icon:"👁️",iconColor:"amber",title:`Hide "${name}"?`,subtitle:"Item will disappear from the menu",body:`<p>The item won't show in orders but history is preserved. You can restore it anytime.</p>`,buttons:[{label:"Hide item",value:"yes",style:"danger"},{label:"Cancel",value:"no",style:""}]});
  if(res.action!=="yes") return;
  try{
    await dbDeactivateMenuItem(dbId);
    const idx=customMenuItems.findIndex(i=>i.id===dbId);
    if(idx>-1) customMenuItems[idx].active=false;
    lsSave(); buildCatTabs(); renderItems(); renderMenuMgmt();
    showToast(`"${name}" hidden from menu`);
  }catch(e){showToast("Error: "+e.message);}
}

async function overrideHideItem(name){
  const res=await showModal({icon:"👁️",iconColor:"amber",title:`Hide "${name}"?`,subtitle:"Built-in item",body:`<p>This is a built-in item. It will be overridden in cloud and hidden from the menu. You can restore it in the management tab.</p>`,buttons:[{label:"Hide item",value:"yes",style:"danger"},{label:"Cancel",value:"no",style:""}]});
  if(res.action!=="yes") return;
  const baseItem=allItems().find(i=>i.n===name);
  if(!baseItem) return;
  try{
    const [created]=await dbCreateMenuItem({name,price:baseItem.p,category:baseItem.cat,trackQty:baseItem.trackQty,sortOrder:99});
    const updated=await dbDeactivateMenuItem(created.id);
    customMenuItems.push({...created,active:false});
    lsSave(); buildCatTabs(); renderItems(); renderMenuMgmt();
    showToast(`"${name}" hidden`);
  }catch(e){showToast("Error: "+e.message);}
}

/* ── RESTORE ── */
async function restoreMenuItem(dbId){
  const item=customMenuItems.find(i=>i.id===dbId);
  if(!item) return;
  try{
    await dbRestoreMenuItem(dbId);
    item.active=true;
    lsSave(); buildCatTabs(); renderItems(); renderMenuMgmt();
    showToast(`"${item.name}" restored`);
  }catch(e){showToast("Error: "+e.message);}
}

/* ── HARD DELETE ── */
async function hardDeleteMenuItem(dbId){
  const item=customMenuItems.find(i=>i.id===dbId);
  const name=item?.name||"item";
  const res=await showModal({icon:"🗑️",iconColor:"red",title:`Permanently delete "${name}"?`,subtitle:"This cannot be undone",body:`<p>The item will be completely removed from the database. Sales history mentioning it will remain in the logs.</p>`,buttons:[{label:"Delete permanently",value:"yes",style:"danger"},{label:"Cancel",value:"no",style:""}]});
  if(res.action!=="yes") return;
  try{
    await dbHardDeleteMenuItem(dbId);
    customMenuItems=customMenuItems.filter(i=>i.id!==dbId);
    lsSave(); buildCatTabs(); renderItems(); renderMenuMgmt();
    showToast(`"${name}" permanently deleted`);
  }catch(e){showToast("Error: "+e.message);}
}

/* ══════════════════════════════════════════
   START
══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", init);
