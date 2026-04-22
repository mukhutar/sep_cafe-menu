// ─────────────────────────────────────────────
//  db.js  –  Cloud sync via Supabase
//
//  ⚠️  Run this SQL in your Supabase SQL editor
//  to enable the Menu Management tab:
//
//  create table menu_items (
//    id          bigserial primary key,
//    name        text not null,
//    price       numeric not null,
//    category    text not null,
//    track_qty   boolean default false,
//    active      boolean default true,
//    sort_order  int default 0,
//    created_at  timestamptz default now()
//  );
//  alter table menu_items enable row level security;
//  create policy "allow all" on menu_items
//    for all using (true) with check (true);
// ─────────────────────────────────────────────

const SUPABASE_URL = "https://nondijahvqmmspowuzvo.supabase.co";
const SUPABASE_KEY = "sb_publishable_S0Tel_L6cDLzfTXqxHWhwQ_-jmxxiCS";

const DB_READY = SUPABASE_URL !== "YOUR_SUPABASE_URL";

async function dbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey":        SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=representation",
      ...opts.headers
    },
    ...opts
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ── ORDERS ─────────────────────────────────── */
async function dbSaveOrder(order) {
  if (!DB_READY) return;
  return dbFetch("orders", {
    method: "POST",
    body: JSON.stringify({
      order_num: order.id,
      items:     order.items,
      total:     order.total,
      note:      order.note || ""
    })
  });
}
async function dbLoadOrders() {
  if (!DB_READY) return null;
  const rows = await dbFetch("orders?select=*&order=created_at.desc&limit=200");
  return rows.map(r => ({
    id:    r.order_num,
    items: r.items,
    total: parseFloat(r.total),
    note:  r.note,
    time:  new Date(r.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }),
    date:  new Date(r.created_at).toLocaleDateString([], { day:"2-digit", month:"short" }),
    dbId:  r.id
  }));
}
async function dbClearOrders() {
  if (!DB_READY) return;
  return dbFetch("orders?id=gt.0", { method:"DELETE" });
}

/* ── STOCK ──────────────────────────────────── */
async function dbLoadStock() {
  if (!DB_READY) return null;
  const rows = await dbFetch("stock?select=*");
  const map = {};
  rows.forEach(r => map[r.name] = r.qty);
  return map;
}
async function dbSetStock(name, qty) {
  if (!DB_READY) return;
  return dbFetch("stock", {
    method:  "POST",
    headers: { "Prefer":"resolution=merge-duplicates,return=representation" },
    body:    JSON.stringify({ name, qty })
  });
}
async function dbSetStockBatch(entries) {
  if (!DB_READY || !entries.length) return;
  return dbFetch("stock", {
    method:  "POST",
    headers: { "Prefer":"resolution=merge-duplicates,return=representation" },
    body:    JSON.stringify(entries.map(([name, qty]) => ({ name, qty })))
  });
}

/* ── SALES ──────────────────────────────────── */
async function dbLoadSales() {
  if (!DB_READY) return null;
  const rows = await dbFetch("sales?select=*");
  const map = {};
  rows.forEach(r => map[r.name] = { count:r.count, revenue:parseFloat(r.revenue), cat:r.cat });
  return map;
}
async function dbUpsertSales(entries) {
  if (!DB_READY || !entries.length) return;
  return dbFetch("sales", {
    method:  "POST",
    headers: { "Prefer":"resolution=merge-duplicates,return=representation" },
    body:    JSON.stringify(entries)
  });
}
async function dbClearSales() {
  if (!DB_READY) return;
  return dbFetch("sales?name=neq.''", { method:"DELETE" });
}

/* ── MENU ITEMS (CRUD) ──────────────────────── */
// Active items only (for order screen)
async function dbLoadMenuItems() {
  if (!DB_READY) return null;
  try {
    return await dbFetch("menu_items?select=*&active=eq.true&order=category.asc,sort_order.asc,name.asc");
  } catch(e) { console.warn("menu_items table missing – run SQL in db.js"); return null; }
}
// All items including inactive (for management tab)
async function dbLoadAllMenuItems() {
  if (!DB_READY) return null;
  try {
    return await dbFetch("menu_items?select=*&order=category.asc,sort_order.asc,name.asc");
  } catch(e) { return null; }
}
async function dbCreateMenuItem(item) {
  if (!DB_READY) return null;
  return dbFetch("menu_items", {
    method: "POST",
    body: JSON.stringify({
      name:      item.name.trim(),
      price:     parseFloat(item.price),
      category:  item.category,
      track_qty: item.trackQty || false,
      active:    true,
      sort_order: item.sortOrder || 99
    })
  });
}
async function dbUpdateMenuItem(id, fields) {
  if (!DB_READY) return null;
  return dbFetch(`menu_items?id=eq.${id}`, {
    method:  "PATCH",
    headers: { "Prefer":"return=representation" },
    body:    JSON.stringify(fields)
  });
}
// Soft-delete (hides from menu, keeps history)
async function dbDeactivateMenuItem(id) {
  if (!DB_READY) return null;
  return dbFetch(`menu_items?id=eq.${id}`, {
    method:  "PATCH",
    headers: { "Prefer":"return=representation" },
    body:    JSON.stringify({ active: false })
  });
}
async function dbRestoreMenuItem(id) {
  if (!DB_READY) return null;
  return dbFetch(`menu_items?id=eq.${id}`, {
    method:  "PATCH",
    headers: { "Prefer":"return=representation" },
    body:    JSON.stringify({ active: true })
  });
}
// Hard-delete (permanent, use with care)
async function dbHardDeleteMenuItem(id) {
  if (!DB_READY) return null;
  return dbFetch(`menu_items?id=eq.${id}`, { method:"DELETE" });
}
