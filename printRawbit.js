// ─────────────────────────────────────────────
//  print-rawbt.js  –  Sep Cafe ESC/POS via RawBT

const RAWBT_URL = "http://192.168.100.245:8080";

// ── ESC/POS byte builder ───────────────────────
function buildEscPos(order) {
  const b = [];

  // helpers
  const byte  = (...bytes) => bytes.forEach(x => b.push(x));
  const text  = (s) => { for (const c of (s + "\n")) b.push(c.charCodeAt(0) & 0xFF); };
  const dashes = () => text("----------------------------------------");
  const thin   = () => text("- - - - - - - - - - - - - - - - - - - -");

  // Init
  byte(0x1B, 0x40);

  // ── HEADER ──
  byte(0x1B, 0x61, 0x01);           // align center
  byte(0x1B, 0x21, 0x30);           // font large (double w+h)
  text("SEP CAFE");
  byte(0x1B, 0x21, 0x00);           // font normal
  byte(0x1B, 0x45, 0x01);           // bold on
  text("@sep.cafe_oman");
  byte(0x1B, 0x45, 0x00);           // bold off
  text((order.date || "") + "  " + (order.time || ""));
  byte(0x1B, 0x61, 0x00);           // align left
  dashes();

  // ── ORDER NUMBER ──
  byte(0x1B, 0x45, 0x01, 0x1B, 0x21, 0x10); // bold + double height
  text("  Order #" + order.id);
  byte(0x1B, 0x21, 0x00, 0x1B, 0x45, 0x00); // reset

  // ── ITEMS ──
  (order.items || []).forEach(item => {
    const name  = String(item.n || item.name || "");
    const qty   = item.qty || 1;
    const price = ((item.p || item.price || 0) * qty).toFixed(3) + " OMR";
    const left  = "  " + qty + "x " + name;
    const pad   = Math.max(1, 40 - left.length - price.length);
    text(left + " ".repeat(pad) + price);
  });

  dashes();

  // ── TOTAL ──
  byte(0x1B, 0x61, 0x02);           // align right
  byte(0x1B, 0x45, 0x01, 0x1B, 0x21, 0x10); // bold + double height
  text("TOTAL: " + Number(order.total).toFixed(3) + " OMR  ");
  byte(0x1B, 0x21, 0x00, 0x1B, 0x45, 0x00); // reset
  byte(0x1B, 0x61, 0x00);           // align left

  // ── NOTE ──
  if (order.note && order.note.trim()) {
    thin();
    text("  Note: " + order.note);
  }

  dashes();

  // ── FOOTER ──
  byte(0x1B, 0x61, 0x01);           // center
  text("");
  text("Thank you !)");
  byte(0x1B, 0x61, 0x00);           // left

  // Feed + cut
  byte(0x1B, 0x64, 0x04);           // feed 4 lines
  byte(0x1D, 0x56, 0x42, 0x00);     // full cut

  return b;
}

function buildEscPosShift(data) {
  const b = [];
  const byte  = (...bytes) => bytes.forEach(x => b.push(x));
  const text  = (s) => { for (const c of (s + "\n")) b.push(c.charCodeAt(0) & 0xFF); };
  const dashes = () => text("----------------------------------------");

  byte(0x1B, 0x40);                 // init
  byte(0x1B, 0x61, 0x01);           // center
  byte(0x1B, 0x21, 0x30);           // large
  text("SEP CAFE");
  byte(0x1B, 0x21, 0x00);
  byte(0x1B, 0x45, 0x01);
  text("SHIFT SUMMARY");
  byte(0x1B, 0x45, 0x00);
  text(new Date().toLocaleString());
  byte(0x1B, 0x61, 0x00);           // left
  dashes();

  byte(0x1B, 0x45, 0x01);           // bold
  const pad1 = Math.max(1, 30 - "Orders:".length - String(data.orderCount).length);
  text("Orders:" + " ".repeat(pad1) + data.orderCount);
  const pad2 = Math.max(1, 30 - "Items served:".length - String(data.itemCount).length);
  text("Items served:" + " ".repeat(pad2) + data.itemCount);
  const rev  = Number(data.revenue).toFixed(3) + " OMR";
  const pad3 = Math.max(1, 30 - "Revenue:".length - rev.length);
  text("Revenue:" + " ".repeat(pad3) + rev);
  byte(0x1B, 0x45, 0x00);           // bold off

  if (data.topSellers && data.topSellers.length) {
    dashes();
    byte(0x1B, 0x45, 0x01);
    text("TOP SELLERS:");
    byte(0x1B, 0x45, 0x00);
    data.topSellers.forEach(([name, count], i) => {
      const left  = "  " + (i + 1) + ". " + name;
      const right = count + " sold";
      const pad   = Math.max(1, 40 - left.length - right.length);
      text(left + " ".repeat(pad) + right);
    });
  }

  if (data.remainingStock && data.remainingStock.length) {
    dashes();
    byte(0x1B, 0x45, 0x01);
    text("REMAINING SWEETS:");
    byte(0x1B, 0x45, 0x00);
    data.remainingStock.forEach(([name, qty]) => {
      const left  = "  " + name;
      const right = qty + " left";
      const pad   = Math.max(1, 40 - left.length - right.length);
      text(left + " ".repeat(pad) + right);
    });
  }

  dashes();
  byte(0x1B, 0x61, 0x01);
  text("-- End of Shift --");
  byte(0x1B, 0x61, 0x00);
  byte(0x1B, 0x64, 0x04);           // feed
  byte(0x1D, 0x56, 0x42, 0x00);     // cut

  return b;
}

// ── Convert byte array → base64 string ────────
function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

// ── Send to RawBT ──────────────────────────────
async function sendToRawBT(bytes) {
  const base64 = bytesToBase64(bytes);

  // RawBT accepts a JSON body with base64-encoded ESC/POS data
  const res = await fetch(`${RAWBT_URL}/print`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      data:   base64,
      type:   "raw",         // raw ESC/POS
      copies: 1
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error("RawBT error " + res.status + (txt ? ": " + txt : ""));
  }
}

// ── Browser print fallback ─────────────────────
function browserPrintFallback(ord) {
  const el = document.getElementById("print-content");
  el.innerHTML = `<div style="font-family:'Courier New',monospace;font-size:13px;padding:20px;max-width:320px;margin:0 auto">
    <div style="text-align:center;font-size:20px;font-weight:700;letter-spacing:.1em">SEP CAFE</div>
    <div style="text-align:center;font-size:11px;color:#666;margin-bottom:6px">@sep.cafe_oman · ${ord.date || ""} ${ord.time}</div>
    <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
    <div style="font-weight:700">Order #${ord.id}</div>
    ${ord.items.map(i => `<div style="display:flex;justify-content:space-between;margin:3px 0">
      <span>${i.qty}× ${i.n}</span><span>${(i.p * i.qty).toFixed(3)}</span>
    </div>`).join("")}
    <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
    <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px">
      <span>TOTAL</span><span>${ord.total.toFixed(3)} OMR</span>
    </div>
    ${ord.note ? `<div style="font-style:italic;color:#777;margin-top:6px">Note: ${ord.note}</div>` : ""}
    <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
    <div style="text-align:center;font-size:11px;color:#888">Thank you for visiting! ☕</div>
  </div>`;
  setTimeout(() => window.print(), 80);
}

// ══════════════════════════════════════════
//  REPLACE these two functions in app.js
// ══════════════════════════════════════════

async function doPrint(ord) {
  showToast("Sending to printer…", 3000);
  try {
    const bytes = buildEscPos({
      id:    ord.id,
      items: ord.items,
      total: ord.total,
      note:  ord.note  || "",
      time:  ord.time  || "",
      date:  ord.date  || ""
    });
    await sendToRawBT(bytes);
    showToast("✓ Printed!", 2000);
  } catch (err) {
    console.error("RawBT print failed:", err);
    showToast("Printer unreachable — using browser dialog", 3500);
    browserPrintFallback(ord);
  }
}

async function doPrintShiftSummary() {
  const totalRev      = orderHistory.reduce((s, o) => s + o.total, 0);
  const totalItems    = orderHistory.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
  const topSellers    = Object.entries(salesData)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, d]) => [name, d.count]);
  const remainingStock = allItems()
    .filter(i => i.trackQty && stockQty[i.n] !== null)
    .map(i => [i.n, stockQty[i.n]]);

  showToast("Sending shift summary to printer…", 3000);
  try {
    const bytes = buildEscPosShift({
      orderCount: orderHistory.length,
      itemCount:  totalItems,
      revenue:    totalRev,
      topSellers,
      remainingStock
    });
    await sendToRawBT(bytes);
    showToast("✓ Shift summary printed!", 2000);
  } catch (err) {
    console.error("Shift print failed:", err);
    showToast("Printer unreachable — using browser dialog", 3500);
    // fall back to original browser print
    const top5       = Object.entries(salesData).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
    const sweetStock = allItems().filter(i => i.trackQty && stockQty[i.n] !== null);
    const el = document.getElementById("print-content");
    el.innerHTML = `<div style="font-family:'Courier New',monospace;font-size:12px;padding:20px;max-width:320px;margin:0 auto">
      <div style="text-align:center;font-size:18px;font-weight:700">SEP CAFE — SHIFT SUMMARY</div>
      <div style="text-align:center;font-size:10px;color:#666">${new Date().toLocaleString()}</div>
      <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
      <div style="display:flex;justify-content:space-between"><span>Orders</span><span>${orderHistory.length}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Items served</span><span>${totalItems}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700"><span>Revenue</span><span>${totalRev.toFixed(3)} OMR</span></div>
      <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
      <div style="font-weight:700">Top Sellers</div>
      ${top5.map(([n, d], i) => `<div style="display:flex;justify-content:space-between"><span>${i+1}. ${n}</span><span>${d.count} sold</span></div>`).join("")}
      ${sweetStock.length ? `
        <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
        <div style="font-weight:700">Remaining Sweets</div>
        ${sweetStock.map(i => `<div style="display:flex;justify-content:space-between"><span>${i.n}</span><span>${stockQty[i.n]} left</span></div>`).join("")}
      ` : ""}
      <div style="border-top:1px dashed #bbb;margin:8px 0"></div>
      <div style="text-align:center;font-size:10px;color:#888">End of Shift · Sep Cafe</div>
    </div>`;
    setTimeout(() => window.print(), 80);
  }
}