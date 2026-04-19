// ─────────────────────────────────────────────
//  db.js  –  Cloud sync via Supabase

const SUPABASE_URL = "https://nondijahvqmmspowuzvo.supabase.co";   
const SUPABASE_KEY = "sb_publishable_S0Tel_L6cDLzfTXqxHWhwQ_-jmxxiCS";
// ─────────────────────────────────────────────

const DB_READY = SUPABASE_URL !== "YOUR_SUPABASE_URL";

async function dbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...opts.headers
    },
    ...opts
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB error: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── ORDERS ───────────────────────────────────
async function dbSaveOrder(order) {
  if (!DB_READY) return;
  return dbFetch("orders", {
    method: "POST",
    body: JSON.stringify({
      order_num: order.id,
      items: order.items,
      total: order.total,
      note: order.note || ""
    })
  });
}

async function dbLoadOrders() {
  if (!DB_READY) return null;
  const rows = await dbFetch("orders?select=*&order=created_at.desc&limit=200");
  return rows.map(r => ({
    id: r.order_num,
    items: r.items,
    total: parseFloat(r.total),
    note: r.note,
    time: new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    date: new Date(r.created_at).toLocaleDateString([], { day: "2-digit", month: "short" }),
    dbId: r.id
  }));
}

async function dbClearOrders() {
  if (!DB_READY) return;
  return dbFetch("orders?id=gt.0", { method: "DELETE" });
}

// ── STOCK ─────────────────────────────────────
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
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ name, qty })
  });
}

async function dbSetStockBatch(entries) {
  if (!DB_READY) return;
  return dbFetch("stock", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(entries.map(([name, qty]) => ({ name, qty })))
  });
}

// ── SALES ─────────────────────────────────────
async function dbLoadSales() {
  if (!DB_READY) return null;
  const rows = await dbFetch("sales?select=*");
  const map = {};
  rows.forEach(r => map[r.name] = { count: r.count, revenue: parseFloat(r.revenue), cat: r.cat });
  return map;
}

async function dbUpsertSales(entries) {
  if (!DB_READY) return;
  return dbFetch("sales", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(entries)
  });
}

async function dbClearSales() {
  if (!DB_READY) return;
  return dbFetch("sales?name=neq.''", { method: "DELETE" });
}
