import "./style.css";

/* ---------------- Config ---------------- */
const API_BASE = "https://mempool.space/api";
const POLL_MS = 1500;
const BLOCK_POLL_MS = 15000;
const FEED_LIMIT = 50;
const MAX_NEW_TX_PER_TICK = 25;
const WHALE_THRESHOLD = 5; // BTC
const BELT_BASELINE_Y = 190;

/* ---------------- Mining constants (must exist before applyTheme redraw) ---------------- */
const MAX_SUPPLY_SATS = 21000000n * 100000000n;
const HALVING_INTERVAL = 210000;

/* ---------------- DOM ---------------- */
const feedEl = document.getElementById("feed");
const statusEl = document.getElementById("status");
const pauseBtn = document.getElementById("pauseBtn");
const themeBtn = document.getElementById("themeBtn");

const searchInputEl = document.getElementById("searchInput");
const searchBtnEl = document.getElementById("searchBtn");
const searchClearEl = document.getElementById("searchClear");

const learnModeEl = document.getElementById("learnMode");
const tooltipEl = document.getElementById("tooltip");
const learnBoxEl = document.getElementById("learnBox");

const timeHdrEl = document.getElementById("Time");
const fromHdrEl = document.getElementById("From");
const toHdrEl = document.getElementById("To");
const feeHdrEl = document.getElementById("Fee");
const amountHdrEl = document.getElementById("Amount");

const minedDisplayEl = document.getElementById("minedDisplay");
const subsidyValueEl = document.getElementById("subsidyValue");

/* KPI: Supply */
const supplyValueEl = document.getElementById("supplyValue");
const remainingValueEl = document.getElementById("remainingValue");
const supplyBarEl = document.getElementById("supplyBar");
const supplyPctEl = document.getElementById("supplyPct");

/* KPI: Price */
const btcPriceEl = document.getElementById("btcPrice");
const priceUpdatedEl = document.getElementById("priceUpdated");
const priceChangeEl = document.getElementById("priceChange");
const priceChart = document.getElementById("priceChart");
const pctx = priceChart ? priceChart.getContext("2d") : null;

/* KPI: Halving */
const halvingDaysEl = document.getElementById("halvingDays");
const halvingHeightEl = document.getElementById("halvingHeight");
const halvingBlocksLeftEl = document.getElementById("halvingBlocksLeft");
const halvingGauge = document.getElementById("halvingGauge");
const gctx = halvingGauge ? halvingGauge.getContext("2d") : null;

/* Details */
const detailsEl = document.getElementById("details");
const detailsContentEl = document.getElementById("detailsContent");
const closeDetailsBtn = document.getElementById("closeDetailsBtn");

/* Main canvas */
const canvas = document.getElementById("yard");
const ctx = canvas ? canvas.getContext("2d") : null;

/* Tabs */
const rangeTabs = Array.from(document.querySelectorAll(".tab"));

/* ---------------- State (single source of truth) ---------------- */
let lastPriceSeries = null;
let lastBlocksLeft = HALVING_INTERVAL;

let currentTipHeight = null;
let currentRange = "365";
let lastPriceUSD = null;

/* ---------------- Helpers ---------------- */
function nowTime() {
  return new Date().toLocaleTimeString();
}
function fmtDateTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function shortTxid(txid) {
  return txid ? txid.slice(0, 10) + "…" + txid.slice(-6) : "";
}
function shortAddr(a) {
  if (!a) return "—";
  if (a.length <= 18) return a;
  return a.slice(0, 10) + "…" + a.slice(-6);
}
function isTxid(q) {
  return /^[0-9a-fA-F]{64}$/.test(q);
}
function isBtcAddress(q) {
  return /^(bc1)[0-9a-z]{20,}|[13][a-km-zA-HJ-NP-Z1-9]{20,}$/.test(q);
}


function fmtUSD(x) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function clearC(c, w, h)
 {
  c.clearRect(0, 0, w, h);
}
// --- NEW: de-DE number formatting (Tausenderpunkte) ---
const NF_BTC_2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NF_BTC_8 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 8, maximumFractionDigits: 8 });

function fmtBtcDe(num, decimals = 2) {
  if (!Number.isFinite(num)) return "—";
  return (decimals === 8 ? NF_BTC_8 : NF_BTC_2).format(num);
}

// --- NEW: current block subsidy at height (BTC) ---
function blockSubsidyBtcAtHeight(height) {
  if (!Number.isFinite(height)) return null;
  const era = Math.floor(height / HALVING_INTERVAL);
  const sats = (50n * 100000000n) >> BigInt(era);
  return Number(sats) / 1e8;
}

/* ---------------- Theme (default dark) ---------------- */
function updateLogoForTheme(isDark) {
  const logo = document.getElementById("brandLogo");
  if (!logo) return;

  logo.src = isDark
    ? "/logo-dark.png"
    : "/logo-light.png";
}
updateLogoForTheme(document.body.classList.contains("dark"));
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  updateLogoForTheme(document.body.classList.contains("dark"));
});

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (themeBtn) themeBtn.textContent = theme === "dark" ? "Light" : "Dark";
  localStorage.setItem("theme", theme);

  // redraw charts (safe)
  if (pctx && priceChart && Array.isArray(lastPriceSeries)) drawPriceSeries(lastPriceSeries);
  if (gctx && halvingGauge && Number.isFinite(lastBlocksLeft)) drawHalvingGauge(lastBlocksLeft, HALVING_INTERVAL);

  }

const savedTheme = localStorage.getItem("theme");
applyTheme(savedTheme || "dark"); // default = dark
// first paint (factory will be drawn anyway by the animation loop)
if (typeof drawFactory === "function") {
  try { drawFactory(); } catch {} // ignore until constants ready
}
themeBtn?.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
});

/* ---------------- Learning mode tooltips ---------------- */
let learningMode = false;

function showTooltip(x, y, title, desc) {
  if (!tooltipEl) return;
  tooltipEl.innerHTML = `<div class="t">${title}</div><div class="d">${desc}</div>`;
  tooltipEl.classList.remove("hidden");

  const pad = 12;
  const w = tooltipEl.offsetWidth || 260;
  const h = tooltipEl.offsetHeight || 60;

  let left = x + pad;
  let top = y + pad;

  if (left + w > window.innerWidth - 10) left = x - w - pad;
  if (top + h > window.innerHeight - 10) top = y - h - pad;

  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
}
function hideTooltip() {
  tooltipEl?.classList.add("hidden");
}
function bindTip(el, title, desc) {
  if (!el) return;
  el.addEventListener("mouseenter", (e) => {
    if (!learningMode) return;
    showTooltip(e.clientX, e.clientY, title, desc);
  });
  el.addEventListener("mousemove", (e) => {
    if (!learningMode) return;
    showTooltip(e.clientX, e.clientY, title, desc);
  });
  el.addEventListener("mouseleave", hideTooltip);
}
function renderLearnBox() {
  if (!learnBoxEl) return;
  if (!learningMode) {
    learnBoxEl.classList.add("hidden");
    return;
  }
  learnBoxEl.classList.remove("hidden");
  learnBoxEl.innerHTML = `
    <div style="font-weight:900;margin-bottom:6px;">What you’re seeing</div>
    <ul>
      <li><b>Feed</b>: mempool “recent” transactions (unconfirmed).</li>
      <li><b>Train capsules</b>: each capsule represents one transaction.</li>
      <li><b>Block module</b>: counts incoming transactions until a new block is mined.</li>
      <li><b>Supply</b>: computed from the halving schedule, based on current block height.</li>
      <li><b>Price</b>: pulled from mempool.space (no CoinGecko CORS issues).</li>
    </ul>
  `;
}
learnModeEl?.addEventListener("change", () => {
  learningMode = !!learnModeEl.checked;
  hideTooltip();
  renderLearnBox();
});
renderLearnBox();

bindTip(minedDisplayEl, "Mined BTC", "Estimated BTC mined from the current block height (subsidy schedule).");
window.addEventListener("DOMContentLoaded", () => {
  bindTip(timeHdrEl, "Time", "When it was seen by the mempool feed (unconfirmed).");
  bindTip(fromHdrEl, "From", "First input address (often one of many).");
  bindTip(toHdrEl, "To", "Largest output address (often main receiver).");
  bindTip(feeHdrEl, "Fee (sat/vB)", "Fee rate: satoshis per virtual byte.");
  bindTip(amountHdrEl, "Amount (BTC)", "Total BTC moved (mempool.recent value).");
});

/* ---------------- Details ---------------- */
closeDetailsBtn?.addEventListener("click", () => detailsEl.classList.add("hidden"));

function openDetails(title, html) {
  detailsEl.classList.remove("hidden");
  detailsContentEl.innerHTML = `<div style="font-weight:900;margin-bottom:8px;">${title}</div>${html}`;
}
function satsToBtc(sats) {
  return (sats / 100000000).toFixed(8);
}

async function loadDetails(txid) {
  detailsEl.classList.remove("hidden");
  detailsContentEl.innerHTML = "Loading…";
  try {
    const res = await fetch(`${API_BASE}/tx/${txid}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const confirmed = !!data?.status?.confirmed;
    const fee = data.fee ?? null;
    const vsize = data.vsize ?? data.size ?? null;
    const feeRate = (fee != null && vsize) ? (fee / vsize) : null;

    const vin = Array.isArray(data.vin) ? data.vin : [];
    const vout = Array.isArray(data.vout) ? data.vout : [];

    const inputSumSats = vin.reduce((sum, x) => sum + (x?.prevout?.value ?? 0), 0);
    const outputSumSats = vout.reduce((sum, x) => sum + (x?.value ?? 0), 0);

    const link = `https://mempool.space/tx/${txid}`;

    detailsContentEl.innerHTML = `
      <div class="detailsGrid">
        <div class="k">TXID</div>
        <div class="v mono"><a href="${link}" target="_blank" rel="noreferrer">${txid}</a></div>

        <div class="k">Status</div>
        <div class="v">
          <span class="badge ${confirmed ? "ok" : "no"}">${confirmed ? "Confirmed" : "Unconfirmed"}</span>
        </div>

        <div class="k">Fee</div>
        <div class="v">${fee != null ? `${fee} sats` : "—"}</div>

        <div class="k">Size</div>
        <div class="v">${vsize != null ? `${vsize} vB` : "—"}</div>

        <div class="k">Fee rate</div>
        <div class="v">${feeRate != null ? `${feeRate.toFixed(1)} sat/vB` : "—"}</div>

        <div class="k">Inputs (sum)</div>
        <div class="v">${satsToBtc(inputSumSats)} BTC</div>

        <div class="k">Outputs (sum)</div>
        <div class="v">${satsToBtc(outputSumSats)} BTC</div>
      </div>

      <div class="outs">
        <h3>Outputs</h3>
        ${vout.map(o => {
          const addr = o?.scriptpubkey_address ?? "(no address)";
          const val = o?.value ?? 0;
          return `
            <div class="out">
              <div class="addr mono" title="${addr}">${addr}</div>
              <div class="mono">${satsToBtc(val)} BTC</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } catch (e) {
    detailsContentEl.innerHTML = `Error: ${e.message}`;
  }
}

/* ---------------- Address balance + last 5 tx ---------------- */
async function fetchAddressBalance(address) {
  const res = await fetch(`${API_BASE}/address/${address}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const cs = data.chain_stats || {};
  const ms = data.mempool_stats || {};

  const confirmedSats = (cs.funded_txo_sum ?? 0) - (cs.spent_txo_sum ?? 0);
  const mempoolDeltaSats = (ms.funded_txo_sum ?? 0) - (ms.spent_txo_sum ?? 0);
  const totalSats = confirmedSats + mempoolDeltaSats;

  return { confirmedSats, mempoolDeltaSats, totalSats };
}

async function loadAddressTxs(address) {
  openDetails("Address", `<div class="mono">${address}</div><div style="margin-top:8px;">Loading…</div>`);

  const bal = await fetchAddressBalance(address);
  const totalBtc = (bal.totalSats / 100000000);

  const header = `
    <div class="mono">${address}</div>
    <div style="margin-top:10px;" class="card">
      <div style="padding:12px;border-radius:14px;">
        <div class="muted" style="font-size:12px;letter-spacing:.08em;">WALLET BALANCE</div>
        <div style="font-weight:950;font-size:22px;margin-top:6px;">
          ${totalBtc.toFixed(8)} <span class="muted" style="font-size:12px;font-weight:900;">BTC</span>
        </div>
        <div class="muted" style="margin-top:6px;font-size:12px;">
          confirmed: ${satsToBtc(bal.confirmedSats)} BTC • mempool delta: ${satsToBtc(bal.mempoolDeltaSats)} BTC
        </div>
      </div>
    </div>
  `;

  const res = await fetch(`${API_BASE}/address/${address}/txs`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const txs = await res.json();

  if (!Array.isArray(txs) || txs.length === 0) {
    openDetails("Address", `${header}<div style="margin-top:10px;">No transactions found.</div>`);
    return;
  }

  const rows = txs.slice(0, 5).map(tx => {
    const txid = tx.txid || tx.txId || tx.hash || "";
    const fee = tx.fee ?? null;
    const vsize = tx.vsize ?? tx.size ?? null;
    const feeRate = (fee != null && vsize) ? (fee / vsize) : null;

    return `
      <div class="out" style="cursor:pointer;" data-txid="${txid}">
        <div class="mono">${shortTxid(txid)}</div>
        <div class="muted">${feeRate != null ? feeRate.toFixed(1) + " sat/vB" : "—"}</div>
      </div>
    `;
  }).join("");

  openDetails(
    "Address",
    `${header}
     <div style="margin-top:12px;font-weight:900;">Last 5 transactions</div>
     <div style="margin-top:8px;">${rows}</div>
     <div class="muted" style="margin-top:10px;">Click a transaction to view details.</div>`
  );

  detailsContentEl.querySelectorAll("[data-txid]").forEach(el => {
    el.addEventListener("click", () => {
      const txid = el.getAttribute("data-txid");
      if (txid) loadDetails(txid);
    });
  });
}

/* ---------------- Search ---------------- */
async function runSearch() {
  const q = (searchInputEl?.value || "").trim();
  if (!q) return;

  try {
    if (isTxid(q)) return await loadDetails(q);
    if (isBtcAddress(q)) return await loadAddressTxs(q);
    openDetails("Search", `<div>Paste a TXID (64 hex) or a Bitcoin address.</div>`);
  } catch (e) {
    openDetails("Error", `<div>${e.message}</div>`);
  }
}
searchBtnEl?.addEventListener("click", runSearch);
searchInputEl?.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });
searchClearEl?.addEventListener("click", () => { if (searchInputEl) searchInputEl.value = ""; });

/* ---------------- Mining stats (Supply/Halving) ---------------- */
function minedSatsAtTipHeight(tipHeight) {
  let remaining = BigInt(tipHeight) + 1n;
  const eraSize = 210000n;
  let era = 0n;
  let total = 0n;

  while (remaining > 0n) {
    const blocksThisEra = remaining > eraSize ? eraSize : remaining;
    const subsidy = (50n * 100000000n) >> era;
    if (subsidy === 0n) break;
    total += blocksThisEra * subsidy;
    remaining -= blocksThisEra;
    era += 1n;
  }
  return total;
}
function formatBtcFromSatsBigint(sats, decimals = 2) {
  const SATS_PER_BTC = 100000000n;
  const whole = sats / SATS_PER_BTC;
  const frac = sats % SATS_PER_BTC;
  const scale = 10n ** BigInt(decimals);
  const fracScaled = (frac * scale) / SATS_PER_BTC;
  return `${whole.toString()}.${fracScaled.toString().padStart(decimals, "0")}`;
}
function daysUntilNextHalving(tipHeight) {
  if (!Number.isFinite(tipHeight)) return null;
  const nextHalvingHeight = Math.ceil((tipHeight + 1) / HALVING_INTERVAL) * HALVING_INTERVAL;
  const blocksLeft = nextHalvingHeight - tipHeight;
  const daysLeft = (blocksLeft * 10) / 1440;
  return { nextHalvingHeight, blocksLeft, daysLeft };
}
function updateSupplyCard(minedSats, remainingSats) {
  const minedBtc = Number(minedSats) / 1e8;
  const remainingBtc = Number(remainingSats) / 1e8;

  // Anzeige mit Tausenderpunkten
  if (supplyValueEl) supplyValueEl.textContent = fmtBtcDe(minedBtc, 2);
  if (remainingValueEl) remainingValueEl.textContent = fmtBtcDe(remainingBtc, 2);

  // optional: Subsidy anzeigen (falls Element existiert)
  if (subsidyValueEl) {
    const sub = blockSubsidyBtcAtHeight(currentTipHeight);
    subsidyValueEl.textContent = sub == null ? "—" : fmtBtcDe(sub, 8);
  }

  // Prozent (wie gehabt)
  const max = 21000000;
  const pct = max > 0 ? (minedBtc / max) * 100 : 0;
  if (supplyPctEl) supplyPctEl.textContent = `${pct.toFixed(2)}%`;
  if (supplyBarEl) supplyBarEl.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function updateHalvingCard(h) {
  if (!h) return;
  if (halvingDaysEl) halvingDaysEl.textContent = Math.round(h.daysLeft).toString();
  if (halvingHeightEl) halvingHeightEl.textContent = `at block ${h.nextHalvingHeight.toLocaleString()}`;
  if (halvingBlocksLeftEl) halvingBlocksLeftEl.textContent = `${h.blocksLeft.toLocaleString()} blocks to go`;

  lastBlocksLeft = h.blocksLeft;
  drawHalvingGauge(h.blocksLeft, HALVING_INTERVAL);
}
function updateMinedDisplayFromTip() {
  if (!minedDisplayEl) return;

  if (!Number.isFinite(currentTipHeight)) {
    minedDisplayEl.innerHTML = `
      <div class="big">— BTC mined</div>
      <div class="sub">Remaining: — BTC</div>
      <div class="sub">Next halving: — days</div>
    `;
    return;
  }

  try {
    const minedSats = minedSatsAtTipHeight(currentTipHeight);
    const remainingSats = MAX_SUPPLY_SATS > minedSats ? (MAX_SUPPLY_SATS - minedSats) : 0n;

    const minedStr = formatBtcFromSatsBigint(minedSats, 2);
    const remainingStr = formatBtcFromSatsBigint(remainingSats, 2);

    const h = daysUntilNextHalving(currentTipHeight);
    const daysStr = h ? Math.round(h.daysLeft).toString() : "—";

    minedDisplayEl.innerHTML = `
      <div class="big">${minedStr} BTC mined</div>
      <div class="sub">Remaining: ${remainingStr} BTC</div>
      <div class="sub">Next halving: ${daysStr} days</div>
    `;

    updateSupplyCard(minedSats, remainingSats);

    updateHalvingCard(h);
  } catch (e) {
    console.log("updateMinedDisplayFromTip error:", e);
  }
}

/* ---------------- Price (mempool.space) ---------------- */
async function fetchMempoolPrices() {
  const res = await fetch(`${API_BASE}/v1/prices`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json(); // { USD: number, ... }
}

async function fetchMempoolHistoricalUSD(range) {
  // CORS-freundliche Quelle für Browser
  const map = { "1": "1days", "7": "7days", "365": "1years", "max": "all" };
  const timespan = map[range] || "1days";

  try {
    const url = `https://api.blockchain.info/charts/market-price?timespan=${timespan}&format=json&cors=true`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const vals = Array.isArray(data?.values) ? data.values : [];
    const pts = vals
      .map(v => ({ t: Number(v.x) * 1000, v: Number(v.y) })) // x ist Sekunden -> ms
      .filter(p => Number.isFinite(p.t) && Number.isFinite(p.v));

    if (pts.length >= 2) return pts;
  } catch (e) {
    console.log("historical chart failed:", e);
  }

  // fallback: flat (wie vorher), aber mit mehr Punkten
  const p = await fetchMempoolPrices();
  const usd = Number(p?.USD);
  const now = Date.now();

  const n = 120;
  const spanMs =
    range === "7" ? 7 * 24 * 3600e3 :
    range === "365" ? 365 * 24 * 3600e3 :
    range === "max" ? 10 * 365 * 24 * 3600e3 :
    24 * 3600e3;

  const points = [];
  for (let i = 0; i < n; i++) {
    const t = now - spanMs + (spanMs * i) / (n - 1);
    points.push({ t, v: usd });
  }
  return points;
}

function drawPriceSeries(series) {
  if (!pctx || !priceChart) return;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const W = priceChart.width;
  const H = priceChart.height;

  clearC(pctx, W, H);

  pctx.fillStyle = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  pctx.fillRect(0, 0, W, H);

  if (!Array.isArray(series) || series.length < 2) return;

  const pad = 12;
  const xs = series.map((p) => p.t);
  const ys = series.map((p) => p.v);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1e-9, maxY - minY);

  const x = (t) => pad + ((t - minX) / spanX) * (W - pad * 2);
  const y = (v) => (H - pad) - ((v - minY) / spanY) * (H - pad * 2);

  const grad = pctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, isDark ? "rgba(122,170,255,0.95)" : "rgba(70,120,255,0.85)");
  grad.addColorStop(0.5, "rgba(242,193,78,0.95)");
  grad.addColorStop(1, "rgba(25,195,125,0.95)");

  // area
  pctx.beginPath();
  pctx.moveTo(x(series[0].t), y(series[0].v));
  for (let i = 1; i < series.length; i++) pctx.lineTo(x(series[i].t), y(series[i].v));
  pctx.lineTo(x(series[series.length - 1].t), H - pad);
  pctx.lineTo(x(series[0].t), H - pad);
  pctx.closePath();
  pctx.fillStyle = isDark ? "rgba(25,195,125,0.06)" : "rgba(25,195,125,0.10)";
  pctx.fill();

  // line
  pctx.beginPath();
  pctx.moveTo(x(series[0].t), y(series[0].v));
  for (let i = 1; i < series.length; i++) pctx.lineTo(x(series[i].t), y(series[i].v));
  pctx.strokeStyle = grad;
  pctx.lineWidth = 2;
  pctx.stroke();

  pctx.strokeStyle = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  pctx.strokeRect(0.5, 0.5, W - 1, H - 1);
}

async function refreshPrice(range = currentRange) {
  try {
    const prices = await fetchMempoolPrices();
    const usd = Number(prices?.USD);

    if (btcPriceEl) btcPriceEl.textContent = fmtUSD(usd);

    if (Number.isFinite(usd) && Number.isFinite(lastPriceUSD)) {
      const delta = usd - lastPriceUSD;
      const pct = lastPriceUSD !== 0 ? (delta / lastPriceUSD) * 100 : 0;
      const sign = delta >= 0 ? "+" : "";
      if (priceChangeEl) {
        priceChangeEl.textContent = `${sign}${pct.toFixed(2)}%`;
        priceChangeEl.classList.remove("pos", "neg");
        priceChangeEl.classList.add(delta >= 0 ? "pos" : "neg");
      }
    } else {
      if (priceChangeEl) {
        priceChangeEl.textContent = "—";
        priceChangeEl.classList.remove("pos", "neg");
      }
    }
    lastPriceUSD = usd;
    if (priceUpdatedEl) priceUpdatedEl.textContent = `updated ${nowTime()}`;

    const series = await fetchMempoolHistoricalUSD(range);
    lastPriceSeries = series;
    drawPriceSeries(series);
  } catch (e) {
    console.log("price error:", e);
  }
}

function setRangeActive(range) {
  currentRange = range;
  rangeTabs.forEach((b) => b.classList.toggle("active", b.dataset.range === range));
}
rangeTabs.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const r = btn.dataset.range;
    setRangeActive(r);
    await refreshPrice(r);
  });
});

/* ---------------- Halving gauge ---------------- */
function drawHalvingGauge(blocksLeft, interval) {
  if (!gctx || !halvingGauge) return;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const W = halvingGauge.width;
  const H = halvingGauge.height;

  clearC(gctx, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.38;

  const progress = Math.max(0, Math.min(1, 1 - blocksLeft / interval));
  const start = -Math.PI * 0.8;
  const end = Math.PI * 0.8;

  gctx.lineWidth = 16;
  gctx.lineCap = "round";

  gctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  gctx.beginPath();
  gctx.arc(cx, cy, r, start, end);
  gctx.stroke();

  const progEnd = start + (end - start) * progress;
  const grad = gctx.createLinearGradient(cx - r, cy, cx + r, cy);
  grad.addColorStop(0, "rgba(122,170,255,0.95)");
  grad.addColorStop(0.5, "rgba(242,193,78,0.95)");
  grad.addColorStop(1, "rgba(25,195,125,0.95)");

  gctx.strokeStyle = grad;
  gctx.beginPath();
  gctx.arc(cx, cy, r, start, progEnd);
  gctx.stroke();

  gctx.lineWidth = 1;
  gctx.strokeStyle = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.14)";
  gctx.beginPath();
  gctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
  gctx.stroke();
}

/* ---------------- Feed (transactions) ---------------- */
let paused = false;
const seen = new Set();

let inflight = 0;
const MAX_INFLIGHT = 4;
const addrQueue = [];

function scheduleAddrFetch(task) {
  addrQueue.push(task);
  pumpAddrQueue();
}
function pumpAddrQueue() {
  while (inflight < MAX_INFLIGHT && addrQueue.length) {
    const t = addrQueue.shift();
    inflight++;
    t().finally(() => {
      inflight--;
      pumpAddrQueue();
    });
  }
}

pauseBtn?.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  if (statusEl) statusEl.textContent = paused ? "Paused" : "Running…";
});

async function fetchRecent() {
  const res = await fetch(`${API_BASE}/mempool/recent`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function addItem({ txid, fee, vsize, valueSats }, fragment) {
  const feeRate = (fee && vsize) ? (fee / vsize) : null;
  const btc = (valueSats != null) ? (valueSats / 100000000) : null;
  const amountText = (btc != null) ? `${btc.toFixed(8)} BTC` : "—";
  const isBig = (btc != null && btc >= WHALE_THRESHOLD);

  const li = document.createElement("li");
  li.className = "item";
  li.style.cursor = "pointer";
  li.addEventListener("click", () => loadDetails(txid));

  const fromEl = document.createElement("div");
  fromEl.className = "addr";
  fromEl.textContent = "loading…";

  const toEl = document.createElement("div");
  toEl.className = "addr";
  toEl.textContent = "loading…";

  const feeText = feeRate != null ? `${feeRate.toFixed(1)} sat/vB` : "—";

  li.innerHTML = `
    <div class="row">
      <div class="timecell muted"><span>${fmtDateTime()}</span></div>
      <div class="from-slot"></div>
      <div class="to-slot"></div>
      <div class="muted">${feeText}</div>
      <div class="value right ${isBig ? "big" : ""}">${amountText}</div>
    </div>
  `;

  li.querySelector(".from-slot").appendChild(fromEl);
  li.querySelector(".to-slot").appendChild(toEl);
  if (isBig) li.classList.add("big-btc");

  fragment.prepend(li);

  // spawn capsule in factory
  spawnPackage({ txid, btc, feeRate });

  scheduleAddrFetch(async () => {
    try {
      const res = await fetch(`${API_BASE}/tx/${txid}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const vin = Array.isArray(data.vin) ? data.vin : [];
      const vout = Array.isArray(data.vout) ? data.vout : [];

      const fromAddr = vin[0]?.prevout?.scriptpubkey_address ?? "";
      const fromMore = Math.max(0, vin.length - 1);

      let best = null;
      for (const o of vout) {
        if (!best || (o?.value ?? 0) > (best?.value ?? 0)) best = o;
      }
      const toAddr = best?.scriptpubkey_address ?? "";
      const toMore = Math.max(0, vout.length - 1);

      fromEl.textContent = fromAddr ? `${shortAddr(fromAddr)}${fromMore ? ` (+${fromMore})` : ""}` : "—";
      toEl.textContent = toAddr ? `${shortAddr(toAddr)}${toMore ? ` (+${toMore})` : ""}` : "—";
      fromEl.title = fromAddr || "";
      toEl.title = toAddr || "";
      fromEl.classList.add("loaded");
      toEl.classList.add("loaded");
    } catch {
      fromEl.textContent = "—";
      toEl.textContent = "—";
    }
  });
}

async function tick() {
  if (paused) return;
  if (!feedEl) return;

  try {
    if (statusEl) statusEl.textContent = "Loading…";
    const txs = await fetchRecent();

    const newOnes = [];
    for (const tx of txs) {
      const txid = tx.txid || tx.txId || tx.hash;
      if (!txid) continue;
      if (seen.has(txid)) continue;
      seen.add(txid);
      newOnes.push(tx);
      if (newOnes.length >= MAX_NEW_TX_PER_TICK) break;
    }

    const frag = document.createDocumentFragment();
    for (const tx of newOnes) {
      const txid = tx.txid || tx.txId || tx.hash;
      const fee = tx.fee ?? tx.fees;
      const vsize = tx.vsize ?? tx.virtualSize ?? tx.size;
      const valueSats = tx.value ?? tx.amount ?? null;
      addItem({ txid, fee, vsize, valueSats }, frag);
    }

    feedEl.prepend(frag);
    while (feedEl.children.length > FEED_LIMIT) feedEl.removeChild(feedEl.lastChild);

    if (statusEl) statusEl.textContent = `OK • last update ${nowTime()}`;
  } catch (e) {
    if (statusEl) statusEl.textContent = `Error: ${e.message}`;
  }
}

/* ---------------- Block polling + factory state ---------------- */
let blockState = "collecting"; // collecting | confirmed
let confirmTimer = 0;
const CONFIRM_DISPLAY_SECONDS = 1.5;
let currentBlockTxCount = 0;

async function fetchTipHeight() {
  const res = await fetch(`${API_BASE}/blocks/tip/height`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const txt = await res.text();
  const h = parseInt(txt, 10);
  if (!Number.isFinite(h)) throw new Error(`Invalid tip height: "${txt}"`);
  return h;
}
function onBlockConfirmedReset() {
  blockState = "confirmed";
  confirmTimer = 0;
  currentBlockTxCount = 0;
}
async function checkBlocks() {
  try {
    const h = await fetchTipHeight();
    const changed = (currentTipHeight !== h);
    currentTipHeight = h;
    if (changed) onBlockConfirmedReset();
    updateMinedDisplayFromTip();
  } catch (e) {
    console.log("checkBlocks error:", e);
  }
}

/* ---------------- Futuristic Factory Canvas ---------------- */
const BELT_START_X = 0;
const STACK_X = 720;
const STACK_Y = 26;
const STACK_W = 210;
const STACK_H = 210;
const BELT_END_X = STACK_X;

const packages = [];

function resizeCanvasToDisplaySize() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}
window.addEventListener("resize", resizeCanvasToDisplaySize);

function feeBand(feeRate) {
  if (feeRate == null) return "low";
  if (feeRate < 2) return "low";
  if (feeRate < 6) return "med";
  return "high";
}
function feeGlowColor(band) {
  if (band === "high") return [25, 195, 125];
  if (band === "med") return [242, 193, 78];
  return [122, 170, 255];
}

function spawnPackage({ txid, btc, feeRate }) {
  const GAP = 26;

  const base = 16;
  let size = btc != null ? Math.min(68, base + Math.sqrt(btc) * 18) : base;
  if (btc != null && btc >= WHALE_THRESHOLD) size *= 1.15;

  // label (store once so sizing + draw use same string)
  const label =
    btc == null ? "" :
    (btc >= 1 ? btc.toFixed(1) : btc.toFixed(3));

  // --- Ensure capsule is wide enough for the label ---
  // rough monospace width estimate (CSS px). Works well enough without needing ctx/dpr here.
  const approxCharW = 7;              // ~ 11px monospace character width
  const textW = label.length * approxCharW;

  const LED_SPACE = 26;               // left LED + padding
  const SIDE_PAD = 18;                // right padding
  const minW = LED_SPACE + textW + SIDE_PAD;

  // capsule size
  const w = Math.max(size * 1.35, minW);
  const h = Math.max(size * 0.85, 24);

  const speed = 140;

  const last = packages[packages.length - 1];
  const x = last ? (last.x - w - GAP) : (-w);
  const y = BELT_BASELINE_Y - h;

  packages.push({ txid, btc, feeRate, label, x, y, w, h, speed });
  if (packages.length > 140) packages.splice(0, packages.length - 140);
}

function roundRectPath(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function drawFactory() {
  if (!ctx || !canvas) return;
  resizeCanvasToDisplaySize();
  const dpr = window.devicePixelRatio || 1;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = isDark ? "#070a12" : "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const haze = ctx.createRadialGradient(W * 0.2, H * 0.1, 20, W * 0.2, H * 0.1, W * 0.9);
  haze.addColorStop(0, isDark ? "rgba(0,160,255,0.10)" : "rgba(0,160,255,0.08)");
  haze.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);

 // belt "glass rail" (square ends, premium)
const beltY = Math.round(160 * dpr);
const beltH = Math.round(44 * dpr);
const beltX = Math.round(BELT_START_X * dpr); // 0
const beltW = Math.round((BELT_END_X - BELT_START_X) * dpr);

// base glass
ctx.fillStyle = isDark ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.03)";
ctx.fillRect(beltX, beltY, beltW, beltH);

// inner tint gradient
{
  const g = ctx.createLinearGradient(0, beltY, 0, beltY + beltH);
  g.addColorStop(0, isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.65)");
  g.addColorStop(0.5, isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.35)");
  g.addColorStop(1, isDark ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.20)");
  ctx.fillStyle = g;
  ctx.fillRect(beltX, beltY, beltW, beltH);
}

// outer border
ctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
ctx.lineWidth = Math.max(1, Math.round(2 * dpr));
ctx.strokeRect(beltX + 0.5, beltY + 0.5, beltW - 1, beltH - 1);

// neon edge lines (top/bottom)
{
  const topY = beltY + Math.round(6 * dpr);
  const botY = beltY + beltH - Math.round(6 * dpr);

  const edge = ctx.createLinearGradient(beltX, 0, beltX + beltW, 0);
  edge.addColorStop(0, "rgba(122,170,255,0.35)");
  edge.addColorStop(0.55, "rgba(242,193,78,0.25)");
  edge.addColorStop(1, "rgba(25,195,125,0.35)");

  ctx.strokeStyle = isDark ? edge : "rgba(0,160,255,0.20)";
  ctx.lineWidth = Math.max(1, Math.round(1 * dpr));

  ctx.beginPath();
  ctx.moveTo(beltX, topY);
  ctx.lineTo(beltX + beltW, topY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(beltX, botY);
  ctx.lineTo(beltX + beltW, botY);
  ctx.stroke();
}

// moving scanline (subtle)
{
  const scanW = Math.max(50, Math.round(110 * dpr));
  const speed = Math.round(140 * dpr); // px/sec
  const x0 = beltX + ((animTime * speed) % (beltW + scanW)) - scanW;

  const scan = ctx.createLinearGradient(x0, 0, x0 + scanW, 0);
  scan.addColorStop(0, "rgba(0,0,0,0)");
  scan.addColorStop(0.35, isDark ? "rgba(122,170,255,0.07)" : "rgba(0,160,255,0.06)");
  scan.addColorStop(0.5,  isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.08)");
  scan.addColorStop(0.65, isDark ? "rgba(25,195,125,0.06)" : "rgba(25,195,125,0.06)");
  scan.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = scan;
  ctx.fillRect(beltX, beltY, beltW, beltH);
}

// diagonal streaks (keep but soften + animate offset)
{
  ctx.strokeStyle = isDark ? "rgba(122,170,255,0.14)" : "rgba(0,160,255,0.10)";
  ctx.lineWidth = Math.max(1, Math.round(1 * dpr));

  const step = Math.round(34 * dpr);
  const diag = Math.round(14 * dpr);

  // animate the pattern by shifting start
  const offset = Math.round(((animTime * 40) % step) * dpr);

  for (let x = beltX - offset; x < beltX + beltW; x += step) {
    const x2 = Math.min(x + diag, beltX + beltW);
    ctx.beginPath();
    ctx.moveTo(x, beltY + Math.round(6 * dpr));
    ctx.lineTo(x2, beltY + beltH - Math.round(6 * dpr));
    ctx.stroke();
  }
}

// subtle particle dust (super light)
{
  const n = 18; // keep small
  const pr = Math.max(1, Math.round(1.2 * dpr));
  ctx.fillStyle = isDark ? "rgba(235,240,248,0.08)" : "rgba(0,0,0,0.04)";

  for (let i = 0; i < n; i++) {
    // deterministic pseudo-random from i
    const s = (i * 99991) % 997;
    const fx = (s / 997);
    const fy = ((s * 17) % 997) / 997;

    const px = beltX + Math.round((fx * beltW + animTime * (18 + i)) % beltW);
    const py = beltY + Math.round(fy * beltH);

    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}


  const sx = Math.round(STACK_X * dpr);
  const sy = Math.round(STACK_Y * dpr);
  const sw = Math.round(STACK_W * dpr);
  const sh = Math.round(STACK_H * dpr);

  const glow = ctx.createRadialGradient(sx + sw * 0.6, sy + sh * 0.4, 20, sx + sw * 0.6, sy + sh * 0.4, sw * 1.1);
  glow.addColorStop(0, isDark ? "rgba(25,195,125,0.10)" : "rgba(25,195,125,0.08)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 40, sy - 40, sw + 80, sh + 80);

  ctx.fillStyle = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";
  roundRectPath(ctx, sx, sy, sw, sh, Math.round(18 * dpr));
  ctx.fill();

  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)";
  ctx.lineWidth = Math.max(1, Math.round(2 * dpr));
  roundRectPath(ctx, sx, sy, sw, sh, Math.round(18 * dpr));
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let alpha = 1;
  if (blockState === "confirmed") alpha = Math.min(1, confirmTimer / 0.25);

  ctx.fillStyle = isDark ? `rgba(235,240,248,${alpha})` : `rgba(20,20,24,${alpha})`;
  ctx.font = `900 ${Math.round(14 * dpr)}px system-ui`;
  const blockLabel = currentTipHeight != null ? `BLOCK ${currentTipHeight}` : "BLOCK —";
  ctx.fillText(blockLabel, sx + sw / 2, sy + sh / 2 - Math.round(18 * dpr));

  ctx.fillStyle = isDark ? `rgba(25,195,125,${alpha})` : `rgba(10,163,107,${alpha})`;
  if (blockState === "collecting") {
    ctx.font = `950 ${Math.round(28 * dpr)}px system-ui`;
    ctx.fillText(`${currentBlockTxCount.toLocaleString()} TX`, sx + sw / 2, sy + sh / 2 + Math.round(18 * dpr));
  } else {
    ctx.font = `950 ${Math.round(18 * dpr)}px system-ui`;
    ctx.fillText("BLOCK CONFIRMED", sx + sw / 2, sy + sh / 2 + Math.round(18 * dpr));
  }

  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  for (const p of packages) {
    const px = Math.round(p.x * dpr);
    const py = Math.round(p.y * dpr);
    const pw = Math.round(p.w * dpr);
    const ph = Math.round(p.h * dpr);

    const band = feeBand(p.feeRate);
    const [r, g, b] = feeGlowColor(band);

    ctx.fillStyle = isDark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.12)";
    roundRectPath(ctx, px + Math.round(2 * dpr), py + ph + Math.round(3 * dpr), pw, Math.round(6 * dpr), Math.round(6 * dpr));
    ctx.fill();

    ctx.strokeStyle = `rgba(${r},${g},${b},${isDark ? 0.65 : 0.35})`;
    ctx.lineWidth = Math.round(2 * dpr);
    roundRectPath(ctx, px - Math.round(1 * dpr), py - Math.round(1 * dpr), pw + Math.round(2 * dpr), ph + Math.round(2 * dpr), Math.round(999 * dpr));
    ctx.stroke();

    const bodyGrad = ctx.createLinearGradient(px, py, px, py + ph);
    bodyGrad.addColorStop(0, isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.55)");
    bodyGrad.addColorStop(1, isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.25)");
    ctx.fillStyle = bodyGrad;
    roundRectPath(ctx, px, py, pw, ph, Math.round(999 * dpr));
    ctx.fill();

    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
    ctx.lineWidth = Math.max(1, Math.round(1 * dpr));
    roundRectPath(ctx, px + Math.round(2 * dpr), py + Math.round(2 * dpr), pw - Math.round(4 * dpr), ph - Math.round(4 * dpr), Math.round(999 * dpr));
    ctx.stroke();

    ctx.fillStyle = `rgba(${r},${g},${b},${isDark ? 0.85 : 0.60})`;
    ctx.beginPath();
    ctx.arc(px + Math.round(12 * dpr), py + ph / 2, Math.round(3.5 * dpr), 0, Math.PI * 2);
    ctx.fill();

    if (p.label) {
  ctx.fillStyle = isDark ? "rgba(235,240,248,0.88)" : "rgba(20,20,24,0.72)";
  ctx.font = `900 ${Math.round(11 * dpr)}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.label, px + pw / 2, py + ph / 2);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

  }
}

/* ---------------- Animation ---------------- */
let lastT = performance.now();
let animTime = 0; // seconds
function animate(t) {
  const dt = (t - lastT) / 1000;animTime += dt;
  lastT = t;

  if (blockState === "confirmed") {
    confirmTimer += dt;
    if (confirmTimer > CONFIRM_DISPLAY_SECONDS) {
      blockState = "collecting";
      confirmTimer = 0;
      currentBlockTxCount = 0;
    }
  }

  for (const p of packages) p.x += p.speed * dt;

  for (let i = packages.length - 1; i >= 0; i--) {
    const p = packages[i];
    if (p.x + p.w >= BELT_END_X) {
      packages.splice(i, 1);
      currentBlockTxCount++;
    }
  }

  const GAP = 14;
  for (let i = 1; i < packages.length; i++) {
    const front = packages[i - 1];
    const me = packages[i];
    const maxX = front.x - me.w - GAP;
    if (me.x > maxX) me.x = maxX;
  }

  drawFactory();
  requestAnimationFrame(animate);
}

/* ---------------- Block polling boot ---------------- */
async function checkBlocksBoot() {
  await checkBlocks();
  setInterval(checkBlocks, BLOCK_POLL_MS);
}

/* ---------------- App boot ---------------- */
async function start() {
  setRangeActive(currentRange);

  // start loops immediately
  tick();
  setInterval(tick, POLL_MS);

  // block height + supply/halving
  checkBlocksBoot();

  // price: initial + interval
  await refreshPrice(currentRange);
  setInterval(() => refreshPrice(currentRange), 30_000);

  // start animation
  requestAnimationFrame(animate);
}

start();
