import "./style.css";

/* ---------------- Config ---------------- */
const API_BASE = "https://mempool.space/api";
const POLL_MS = 1500;
const BLOCK_POLL_MS = 15000;
const FEED_LIMIT = 50;
const MAX_NEW_TX_PER_TICK = 25;
const WHALE_THRESHOLD = 5; // BTC

/* ---------------- Mining constants ---------------- */
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

/* Inline learn boxes */
const learnSupplyEl = document.getElementById("learnSupply");
const learnPriceEl = document.getElementById("learnPrice");
const learnHalvingEl = document.getElementById("learnHalving");
const learnFeedEl = document.getElementById("learnFeed");

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

/* ---------------- State ---------------- */
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
function clearC(c, w, h) {
  c.clearRect(0, 0, w, h);
}
function isMobile() {
  return window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
}

/* de-DE formatting */
const NF_BTC_2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NF_BTC_8 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 8, maximumFractionDigits: 8 });

function fmtBtcDe(num, decimals = 2) {
  if (!Number.isFinite(num)) return "—";
  return (decimals === 8 ? NF_BTC_8 : NF_BTC_2).format(num);
}

function blockSubsidyBtcAtHeight(height) {
  if (!Number.isFinite(height)) return null;
  const era = Math.floor(height / HALVING_INTERVAL);
  const sats = (50n * 100000000n) >> BigInt(era);
  return Number(sats) / 1e8;
}

/* ---------------- Theme ---------------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);

  if (pctx && priceChart && Array.isArray(lastPriceSeries)) drawPriceSeries(lastPriceSeries);
  if (gctx && halvingGauge && Number.isFinite(lastBlocksLeft)) drawHalvingGauge(lastBlocksLeft, HALVING_INTERVAL);
}

const savedTheme = localStorage.getItem("theme");
applyTheme(savedTheme || "dark");

themeBtn?.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
});

/* ---------------- Learning mode tooltips + inline learn boxes ---------------- */
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

function setLearnInline(el, html) {
  if (!el) return;
  if (!learningMode) {
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  el.innerHTML = html;
}

function renderLearnContent() {
  if (learnBoxEl) {
    if (!learningMode) {
      learnBoxEl.classList.add("hidden");
    } else {
      learnBoxEl.classList.remove("hidden");
      learnBoxEl.innerHTML = `
        <div style="font-weight:900;margin-bottom:6px;">What you’re seeing</div>
        <ul>
          <li><b>Train capsules</b>: each capsule represents one mempool transaction.</li>
          <li><b>Block module</b>: counts transactions that “enter” the next block.</li>
          <li><b>New block</b>: when the chain tip changes, the block confirms and the counter resets.</li>
        </ul>
      `;
    }
  }

  setLearnInline(
    learnSupplyEl,
    `
      <div class="t">What you’re seeing</div>
      <ul>
        <li><b>Current supply</b>: estimated BTC mined so far from the subsidy schedule.</li>
        <li><b>Remaining</b>: how many BTC are left until the 21M cap.</li>
        <li><b>Block reward</b>: new BTC created per block right now.</li>
      </ul>
    `
  );

  setLearnInline(
    learnPriceEl,
    `
      <div class="t">What you’re seeing</div>
      <ul>
        <li><b>Spot price</b>: latest BTC price in USD.</li>
        <li><b>Chart</b>: historical price series for the selected range.</li>
        <li><b>% change</b>: change since the last refresh.</li>
      </ul>
    `
  );

  setLearnInline(
    learnHalvingEl,
    `
      <div class="t">What you’re seeing</div>
      <ul>
        <li><b>Days</b>: estimated days until the next halving (approx. 10 min blocks).</li>
        <li><b>Blocks to go</b>: blocks remaining until the halving height.</li>
        <li><b>Gauge</b>: progress through the current halving epoch.</li>
      </ul>
    `
  );

  setLearnInline(
    learnFeedEl,
    `
      <div class="t">What you’re seeing</div>
      <ul>
        <li><b>Mempool feed</b>: recent unconfirmed transactions seen by mempool.space.</li>
        <li><b>Fee rate</b>: sat/vB (higher usually confirms faster).</li>
        <li><b>Amount</b>: total BTC moved (from the feed endpoint).</li>
      </ul>
    `
  );
}

learnModeEl?.addEventListener("change", () => {
  learningMode = !!learnModeEl.checked;
  hideTooltip();
  renderLearnContent();
});
renderLearnContent();

/* Tooltip bindings */
bindTip(minedDisplayEl, "Mined BTC", "Estimated BTC mined from the current block height (subsidy schedule).");

function bindFeedHeaderTips() {
  const byId = (id) => document.getElementById(id);
  const timeHdrEl = byId("Time");
  const fromHdrEl = byId("From");
  const toHdrEl = byId("To");
  const feeHdrEl = byId("Fee");
  const amountHdrEl = byId("Amount");

  if (timeHdrEl || fromHdrEl || toHdrEl || feeHdrEl || amountHdrEl) {
    bindTip(timeHdrEl, "Time", "When it was seen by the mempool feed (unconfirmed).");
    bindTip(fromHdrEl, "From", "First input address (often one of many).");
    bindTip(toHdrEl, "To", "Largest output address (often main receiver).");
    bindTip(feeHdrEl, "Fee (sat/vB)", "Fee rate: satoshis per virtual byte.");
    bindTip(amountHdrEl, "Amount (BTC)", "Total BTC moved (mempool.recent value).");
    return;
  }

  const feedHeaderEl = document.getElementById("feedHeader");
  if (!feedHeaderEl) return;

  bindTip(feedHeaderEl.querySelector(".col-time"), "Time", "When it was seen by the mempool feed (unconfirmed).");
  bindTip(feedHeaderEl.querySelector(".col-from"), "From", "First input address (often one of many).");
  bindTip(feedHeaderEl.querySelector(".col-to"), "To", "Largest output address (often main receiver).");
  bindTip(feedHeaderEl.querySelector(".col-fee"), "Fee (sat/vB)", "Fee rate: satoshis per virtual byte.");
  bindTip(feedHeaderEl.querySelector(".col-amount"), "Amount (BTC)", "Total BTC moved (mempool.recent value).");
}

window.addEventListener("DOMContentLoaded", bindFeedHeaderTips);

/* ---------------- Details ---------------- */
closeDetailsBtn?.addEventListener("click", () => detailsEl.classList.add("hidden"));

function openDetails(title, html) {
  detailsEl.classList.remove("hidden");
  detailsContentEl.innerHTML = `<div style="font-weight:900;margin-bottom:8px;">${title}</div>${html}`;
  detailsEl.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const feeRate = fee != null && vsize ? fee / vsize : null;

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
        ${vout
          .map((o) => {
            const addr = o?.scriptpubkey_address ?? "(no address)";
            const val = o?.value ?? 0;
            return `
            <div class="out">
              <div class="addr mono" title="${addr}">${addr}</div>
              <div class="mono">${satsToBtc(val)} BTC</div>
            </div>
          `;
          })
          .join("")}
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
  const totalBtc = bal.totalSats / 100000000;

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

  const rows = txs
    .slice(0, 5)
    .map((tx) => {
      const txid = tx.txid || tx.txId || tx.hash || "";
      const fee = tx.fee ?? null;
      const vsize = tx.vsize ?? tx.size ?? null;
      const feeRate = fee != null && vsize ? fee / vsize : null;

      return `
      <div class="out" style="cursor:pointer;" data-txid="${txid}">
        <div class="mono">${shortTxid(txid)}</div>
        <div class="muted">${feeRate != null ? feeRate.toFixed(1) + " sat/vB" : "—"}</div>
      </div>
    `;
    })
    .join("");

  openDetails(
    "Address",
    `${header}
     <div style="margin-top:12px;font-weight:900;">Last 5 transactions</div>
     <div style="margin-top:8px;">${rows}</div>
     <div class="muted" style="margin-top:10px;">Click a transaction to view details.</div>`
  );

  detailsContentEl.querySelectorAll("[data-txid]").forEach((el) => {
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
searchInputEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch();
});
searchClearEl?.addEventListener("click", () => {
  if (searchInputEl) searchInputEl.value = "";
});

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

  if (supplyValueEl) supplyValueEl.textContent = fmtBtcDe(minedBtc, 2);
  if (remainingValueEl) remainingValueEl.textContent = fmtBtcDe(remainingBtc, 2);

  if (subsidyValueEl) {
    const sub = blockSubsidyBtcAtHeight(currentTipHeight);
    subsidyValueEl.textContent = sub == null ? "—" : fmtBtcDe(sub, 8);
  }

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
    const remainingSats = MAX_SUPPLY_SATS > minedSats ? MAX_SUPPLY_SATS - minedSats : 0n;

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

/* ---------------- Price ---------------- */
async function fetchMempoolPrices() {
  const res = await fetch(`${API_BASE}/v1/prices`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function fetchMempoolHistoricalUSD(range) {
  const map = { "1": "1days", "7": "7days", "365": "1years", max: "all" };
  const timespan = map[range] || "1days";

  try {
    const url = `https://api.blockchain.info/charts/market-price?timespan=${timespan}&format=json&cors=true`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const vals = Array.isArray(data?.values) ? data.values : [];
    const pts = vals
      .map((v) => ({ t: Number(v.x) * 1000, v: Number(v.y) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));

    if (pts.length >= 2) return pts;
  } catch (e) {
    console.log("historical chart failed:", e);
  }

  const p = await fetchMempoolPrices();
  const usd = Number(p?.USD);
  const now = Date.now();

  const n = 120;
  const spanMs =
    range === "7"
      ? 7 * 24 * 3600e3
      : range === "365"
        ? 365 * 24 * 3600e3
        : range === "max"
          ? 10 * 365 * 24 * 3600e3
          : 24 * 3600e3;

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
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1e-9, maxY - minY);

  const x = (t) => pad + ((t - minX) / spanX) * (W - pad * 2);
  const y = (v) => H - pad - ((v - minY) / spanY) * (H - pad * 2);

  const grad = pctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, isDark ? "rgba(122,170,255,0.95)" : "rgba(70,120,255,0.85)");
  grad.addColorStop(0.5, "rgba(242,193,78,0.95)");
  grad.addColorStop(1, "rgba(25,195,125,0.95)");

  pctx.beginPath();
  pctx.moveTo(x(series[0].t), y(series[0].v));
  for (let i = 1; i < series.length; i++) pctx.lineTo(x(series[i].t), y(series[i].v));
  pctx.lineTo(x(series[series.length - 1].t), H - pad);
  pctx.lineTo(x(series[0].t), H - pad);
  pctx.closePath();
  pctx.fillStyle = isDark ? "rgba(25,195,125,0.06)" : "rgba(25,195,125,0.10)";
  pctx.fill();

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
    } else if (priceChangeEl) {
      priceChangeEl.textContent = "—";
      priceChangeEl.classList.remove("pos", "neg");
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

/* ---------------- Feed ---------------- */
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

/* ---------------- Factory (premium layout in BASE units) ---------------- */
const BASE_W = 820;
const BASE_H = 260;

/* Belt + block positions in BASE units */
const BELT_Y = 160;
const BELT_H = 44;

const BLOCK_X = 610;
const BLOCK_Y = 28;
const BLOCK_W = 190;
const BLOCK_H = 200;

/* Critical: belt ends EXACTLY at the block LEFT EDGE */
const BLOCK_LEFT_EDGE = BLOCK_X;
const BELT_END_X = BLOCK_LEFT_EDGE;

const packages = [];

function spawnPackage({ txid, btc, feeRate }) {
  const GAP = 26;

  const base = 16;
  let size = btc != null ? Math.min(68, base + Math.sqrt(btc) * 18) : base;
  if (btc != null && btc >= WHALE_THRESHOLD) size *= 1.15;

  const label = btc == null ? "" : btc >= 1 ? btc.toFixed(1) : btc.toFixed(3);

  const approxCharW = 7;
  const textW = label.length * approxCharW;

  const LED_SPACE = 26;
  const SIDE_PAD = 18;
  const minW = LED_SPACE + textW + SIDE_PAD;

  const w = Math.max(size * 1.35, minW);
  const h = Math.max(size * 0.85, 24);

  const speed = 140;

  const last = packages[packages.length - 1];
  const x = last ? last.x - w - GAP : -w;

  packages.push({ txid, btc, feeRate, label, x, w, h, speed });

  /* ✅ FIX: if we must cap, remove newest (off-screen left), NOT the oldest (visible) */
  const KEEP = 140;
  if (packages.length > KEEP) {
    packages.splice(KEEP); // removes from the end
  }
}

function addItem({ txid, fee, vsize, valueSats }, fragment) {
  const feeRate = fee && vsize ? fee / vsize : null;
  const btc = valueSats != null ? valueSats / 100000000 : null;
  const amountText = btc != null ? `${btc.toFixed(8)} BTC` : "—";
  const isBig = btc != null && btc >= WHALE_THRESHOLD;

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

  li.querySelector(".from-slot")?.appendChild(fromEl);
  li.querySelector(".to-slot")?.appendChild(toEl);
  if (isBig) li.classList.add("big-btc");

  fragment.prepend(li);

  spawnPackage({ txid, btc, feeRate });

  // Mobile optimization: From/To are hidden -> skip expensive tx detail fetch
  if (isMobile()) {
    fromEl.textContent = "—";
    toEl.textContent = "—";
    return;
  }

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

let lastBeltSpawnAt = 0;
const BELT_KEEPALIVE_MS = 700;
const beltSeen = new Set();
const BELT_SEEN_LIMIT = 500;

function rememberBeltTx(txid) {
  if (!txid) return;
  beltSeen.add(txid);
  if (beltSeen.size > BELT_SEEN_LIMIT) {
    const it = beltSeen.values();
    for (let i = 0; i < 100; i++) {
      const v = it.next().value;
      if (v == null) break;
      beltSeen.delete(v);
    }
  }
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

    // Keepalive spawn if feed snapshot repeats
    if (newOnes.length === 0) {
      const now = performance.now();
      if (now - lastBeltSpawnAt > BELT_KEEPALIVE_MS) {
        lastBeltSpawnAt = now;

        const pick = [];
        for (const tx of txs) {
          const txid = tx.txid || tx.txId || tx.hash;
          if (!txid) continue;
          if (beltSeen.has(txid)) continue;
          pick.push(tx);
          rememberBeltTx(txid);
          if (pick.length >= 2) break;
        }

        for (const tx of pick) {
          const txid = tx.txid || tx.txId || tx.hash;
          const fee = tx.fee ?? tx.fees;
          const vsize = tx.vsize ?? tx.virtualSize ?? tx.size;
          const valueSats = tx.value ?? tx.amount ?? null;

          const feeRate = fee && vsize ? fee / vsize : null;
          const btc = valueSats != null ? valueSats / 100000000 : null;

          spawnPackage({ txid, btc, feeRate });
        }
      }
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
let blockState = "collecting";
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
    const changed = currentTipHeight !== h;
    currentTipHeight = h;
    if (changed) onBlockConfirmedReset();
    updateMinedDisplayFromTip();
  } catch (e) {
    console.log("checkBlocks error:", e);
  }
}

/* ---------------- Premium Block Factory Canvas ---------------- */
function resizeCanvasToDisplaySize() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  const cssW = Math.max(1, rect.width || canvas.clientWidth || 1);
  const cssH = Math.max(1, rect.height || canvas.clientHeight || 1);

  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));

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

/* Ambient particles */
const particles = [];
let particlesInit = false;
function ensureParticles() {
  if (particlesInit) return;
  particlesInit = true;
  for (let i = 0; i < 26; i++) {
    particles.push({
      x: Math.random() * BASE_W,
      y: Math.random() * BASE_H,
      r: 0.8 + Math.random() * 1.6,
      a: 0.06 + Math.random() * 0.10,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 4,
    });
  }
}

function drawFactory() {
  if (!ctx || !canvas) return;
  ensureParticles();
  resizeCanvasToDisplaySize();

  const dpr = window.devicePixelRatio || 1;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";

  const W = canvas.width;
  const H = canvas.height;

  const fillMode = !isMobile();
  const sx = fillMode ? W / BASE_W : Math.min(W / BASE_W, H / BASE_H);
  const sy = fillMode ? H / BASE_H : sx;

  const stageW = BASE_W * sx;
  const stageH = BASE_H * sy;
  const offX = fillMode ? 0 : (W - stageW) / 2;
  const offY = fillMode ? 0 : (H - stageH) / 2;

  const X = (u) => offX + u * sx;
  const Y = (v) => offY + v * sy;
  const Sx = (n) => n * sx;
  const Sy = (n) => n * sy;

  ctx.clearRect(0, 0, W, H);

  function hashNoise(i) {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }
  function hline(c, x1, x2, y) {
    c.beginPath();
    c.moveTo(x1, y + 0.5);
    c.lineTo(x2, y + 0.5);
    c.stroke();
  }

  function drawBeltFuturistic({ beltX, beltY, beltW, beltH }) {
    const g = ctx.createLinearGradient(0, beltY, 0, beltY + beltH);
    g.addColorStop(0, isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)");
    g.addColorStop(0.55, isDark ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.03)");
    g.addColorStop(1, isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.02)");
    ctx.fillStyle = g;
    ctx.fillRect(beltX, beltY, beltW, beltH);

    ctx.save();
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)";
    ctx.lineWidth = Math.max(1, Math.min(Sx(1.2), Sy(1.2)));
    ctx.strokeRect(beltX + 0.5, beltY + 0.5, beltW - 1, beltH - 1);
    ctx.strokeStyle = isDark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.10)";
    ctx.strokeRect(beltX + Sx(2.5), beltY + Sy(2.5), beltW - Sx(5), beltH - Sy(5));
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(beltX, beltY, beltW, beltH);
    ctx.clip();

    const segW = Math.max(Sx(18), Sy(18));
    const gap = Math.max(Sx(7), Sy(7));
    const stride = segW + gap;
    const offset = -((animTime * Math.max(Sx(140), Sy(140))) % stride);

    for (let x = offset; x < beltW + stride; x += stride) {
      const tG = ctx.createLinearGradient(0, beltY, 0, beltY + beltH);
      tG.addColorStop(0, isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)");
      tG.addColorStop(1, isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)");
      ctx.fillStyle = tG;
      ctx.fillRect(beltX + x, beltY + Sy(6), segW, beltH - Sy(12));
    }

    const scanW = Math.max(Sx(160), Sy(160));
    const speed = Math.max(Sx(240), Sy(240));
    const x0 = beltX + ((animTime * speed) % (beltW + scanW)) - scanW;

    const scan = ctx.createLinearGradient(x0, 0, x0 + scanW, 0);
    scan.addColorStop(0, "rgba(0,0,0,0)");
    scan.addColorStop(0.35, isDark ? "rgba(122,170,255,0.06)" : "rgba(0,160,255,0.05)");
    scan.addColorStop(0.5, isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.08)");
    scan.addColorStop(0.65, "rgba(25,195,125,0.05)");
    scan.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = scan;
    ctx.fillRect(beltX, beltY, beltW, beltH);
    ctx.restore();

    const railY = beltY + Sy(9);
    const railH = Sy(2);
    const rg = ctx.createLinearGradient(beltX, 0, beltX + beltW, 0);
    rg.addColorStop(0, "rgba(122,170,255,0.20)");
    rg.addColorStop(0.55, "rgba(242,193,78,0.14)");
    rg.addColorStop(1, "rgba(25,195,125,0.20)");
    ctx.fillStyle = rg;
    ctx.fillRect(beltX + Sx(10), railY, beltW - Sx(20), railH);

    ctx.save();
    ctx.globalAlpha = isDark ? 0.05 : 0.03;
    ctx.fillStyle = "rgba(255,255,255,1)";
    for (let i = 0; i < 120; i++) {
      const nx = beltX + hashNoise(i * 3.1) * beltW;
      const ny = beltY + hashNoise(i * 7.7) * beltH;
      ctx.fillRect(nx, ny, 1, 1);
    }
    ctx.restore();
  }

  function drawBlockFuturistic({ x, y, w, h }) {
    const rr = Math.min(Sx(24), Sy(24));

    const pulse = 0.55 + 0.45 * Math.sin(animTime * 2.2);
    ctx.save();
    ctx.globalAlpha = (isDark ? 0.22 : 0.14) * pulse;
    const glow = ctx.createRadialGradient(
      x + w * 0.6,
      y + h * 0.45,
      Sy(10),
      x + w * 0.6,
      y + h * 0.45,
      w * 1.15
    );
    glow.addColorStop(0, "rgba(25,195,125,1)");
    glow.addColorStop(0.5, "rgba(122,170,255,0.65)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - w * 0.35, y - h * 0.35, w * 1.7, h * 1.7);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = isDark ? 0.55 : 0.22;
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.filter = `blur(${Math.max(2, Sy(14))}px)`;
    roundRectPath(ctx, x + Sx(6), y + Sy(14), w, h, rr);
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();

    const body = ctx.createLinearGradient(0, y, 0, y + h);
    body.addColorStop(0, isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.75)");
    body.addColorStop(0.55, isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.42)");
    body.addColorStop(1, isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.25)");
    ctx.fillStyle = body;
    roundRectPath(ctx, x, y, w, h, rr);
    ctx.fill();

    const edge = ctx.createLinearGradient(x, 0, x + w, 0);
    edge.addColorStop(0, "rgba(122,170,255,0.55)");
    edge.addColorStop(0.5, "rgba(242,193,78,0.45)");
    edge.addColorStop(1, "rgba(25,195,125,0.55)");
    ctx.save();
    ctx.lineWidth = Math.max(1, Math.min(Sx(2.0), Sy(2.0)));
    ctx.strokeStyle = edge;
    ctx.globalAlpha = isDark ? 0.75 : 0.45;
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, rr);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = isDark ? "rgba(0,0,0,0.32)" : "rgba(0,0,0,0.10)";
    ctx.lineWidth = Math.max(1, Math.min(Sx(1.2), Sy(1.2)));
    roundRectPath(ctx, x + Sx(3), y + Sy(3), w - Sx(6), h - Sy(6), rr - Math.min(Sx(3), Sy(3)));
    ctx.stroke();
    ctx.restore();

    ctx.save();
    const gloss = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
    gloss.addColorStop(0, isDark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.60)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    roundRectPath(ctx, x + Sx(2), y + Sy(2), w - Sx(4), h * 0.55, rr - Math.min(Sx(2), Sy(2)));
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = isDark ? 0.10 : 0.07;
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.9)";
    ctx.lineWidth = Math.max(1, Math.min(Sx(1.1), Sy(1.1))) * 0.6;

    const tx1 = x + Sx(20);
    const tx2 = x + w - Sx(22);
    hline(ctx, tx1, tx2, y + Sy(58));
    hline(ctx, tx1, tx2 - Sx(34), y + Sy(92));
    hline(ctx, tx1 + Sx(12), tx2 - Sx(14), y + Sy(126));

    for (let i = 0; i < 4; i++) {
      const vx = x + Sx(40 + i * 34);
      ctx.beginPath();
      ctx.moveTo(vx + 0.5, y + Sy(58));
      ctx.lineTo(vx + 0.5, y + Sy(126));
      ctx.stroke();
    }

    const run = Math.sin(animTime * 2.4) * 0.5 + 0.5;
    const dx = tx1 + run * (tx2 - tx1);
    ctx.globalAlpha = isDark ? 0.45 : 0.25;
    ctx.fillStyle = "rgba(25,195,125,1)";
    ctx.beginPath();
    ctx.arc(dx, y + Sy(92), Math.max(1.5, Math.min(Sx(3.2), Sy(3.2))), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    const ledY = y + Sy(22);
    const ledX = x + Sx(18);
    const ledGap = Sx(14);
    const ledR = Math.max(1.5, Math.min(Sx(3.2), Sy(3.2)));
    const ledA = blockState === "confirmed" ? 0.98 : 0.85;

    const led = (i, col, a) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(ledX + i * ledGap, ledY, ledR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a * 0.55;
      ctx.filter = `blur(${Math.max(2, Sy(6))}px)`;
      ctx.beginPath();
      ctx.arc(ledX + i * ledGap, ledY, ledR * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = "none";
      ctx.restore();
    };

    led(0, isDark ? "rgba(122,170,255,1)" : "rgba(70,120,255,1)", ledA * 0.6);
    led(1, "rgba(242,193,78,1)", ledA * 0.6);
    led(2, "rgba(25,195,125,1)", ledA);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let alpha = 1;
    if (blockState === "confirmed") alpha = Math.min(1, confirmTimer / 0.25);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = isDark ? "rgba(235,240,248,0.92)" : "rgba(20,20,24,0.78)";
    ctx.font = `900 ${Math.round(Math.min(Sx(12), Sy(12)))}px system-ui`;
    const blockLabel = currentTipHeight != null ? `BLOCK ${currentTipHeight}` : "BLOCK —";
    ctx.fillText(blockLabel, x + w / 2, y + h * 0.48);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = isDark ? "rgba(25,195,125,0.95)" : "rgba(10,163,107,0.95)";
    if (blockState === "collecting") {
      ctx.font = `950 ${Math.round(Math.min(Sx(28), Sy(28)))}px system-ui`;
      ctx.fillText(`${currentBlockTxCount.toLocaleString()} TX`, x + w / 2, y + h * 0.62);
    } else {
      ctx.font = `950 ${Math.round(Math.min(Sx(16), Sy(16)))}px system-ui`;
      ctx.fillText("BLOCK CONFIRMED", x + w / 2, y + h * 0.62);
    }
    ctx.restore();

    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  /* ---------- Background ---------- */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  if (isDark) {
    bg.addColorStop(0, "#070a12");
    bg.addColorStop(1, "#060810");
  } else {
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(1, "#f6f7fb");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const vig = ctx.createRadialGradient(W * 0.55, H * 0.45, 10, W * 0.55, H * 0.45, Math.max(W, H) * 0.85);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, isDark ? "rgba(0,0,0,0.38)" : "rgba(0,0,0,0.10)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  const haze = ctx.createRadialGradient(
    X(160),
    Y(30),
    Math.min(Sx(12), Sy(12)),
    X(160),
    Y(30),
    Math.max(Sx(520), Sy(520))
  );
  haze.addColorStop(0, isDark ? "rgba(0,160,255,0.08)" : "rgba(0,160,255,0.06)");
  haze.addColorStop(0.5, isDark ? "rgba(25,195,125,0.04)" : "rgba(25,195,125,0.04)");
  haze.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = isDark ? 0.08 : 0.06;
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.16)";
  ctx.lineWidth = Math.max(1, Math.round(1 * dpr)) * 0.5;
  const stepX = Sx(26);
  const stepY = Sy(26);
  for (let gx = 0; gx <= W + 1; gx += stepX) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }
  for (let gy = 0; gy <= H + 1; gy += stepY) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  for (const p of particles) {
    const px = X(p.x);
    const py = Y(p.y);
    ctx.globalAlpha = p.a;
    ctx.fillStyle = isDark ? "rgba(235,240,248,1)" : "rgba(20,20,24,1)";
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.5, Math.min(Sx(p.r), Sy(p.r))), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  /* ---------- Geometry ---------- */
  const blockX = X(BLOCK_X);
  const blockY = Y(BLOCK_Y);
  const blockW = Sx(BLOCK_W);
  const blockH = Sy(BLOCK_H);

  const beltX = X(0);
  const beltY = Y(BELT_Y);
  const beltH = Sy(BELT_H);
  const beltW = blockX - X(0);

  drawBeltFuturistic({ beltX, beltY, beltW, beltH });
  drawBlockFuturistic({ x: blockX, y: blockY, w: blockW, h: blockH });

  /* ---------- Capsules ---------- */
  for (const p of packages) {
    const band = feeBand(p.feeRate);
    const [r, g, b] = feeGlowColor(band);

    const px = X(p.x);
    const pw = Sx(p.w);
    const ph = Sy(p.h);

    const py = beltY + (beltH - ph) / 2;

    ctx.save();
    ctx.globalAlpha = isDark ? 0.55 : 0.25;
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.filter = `blur(${Math.max(2, Sy(7))}px)`;
    roundRectPath(ctx, px + Sx(2), py + ph + Sy(6), pw - Sx(2), Sy(7), Math.min(Sx(10), Sy(10)));
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = isDark ? 0.9 : 0.55;
    ctx.strokeStyle = `rgba(${r},${g},${b},${isDark ? 0.55 : 0.30})`;
    ctx.lineWidth = Math.max(1, Math.min(Sx(2.2), Sy(2.2)));
    ctx.filter = `blur(${Math.max(1, Sy(0.6))}px)`;
    roundRectPath(ctx, px - Sx(1), py - Sy(1), pw + Sx(2), ph + Sy(2), 999);
    ctx.stroke();
    ctx.filter = "none";
    ctx.restore();

    const bodyGrad2 = ctx.createLinearGradient(0, py, 0, py + ph);
    bodyGrad2.addColorStop(0, isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.70)");
    bodyGrad2.addColorStop(0.55, isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.42)");
    bodyGrad2.addColorStop(1, isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.28)");
    ctx.fillStyle = bodyGrad2;
    roundRectPath(ctx, px, py, pw, ph, 999);
    ctx.fill();

    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
    ctx.lineWidth = Math.max(1, Math.min(Sx(1), Sy(1)));
    roundRectPath(ctx, px + Sx(2), py + Sy(2), pw - Sx(4), ph - Sy(4), 999);
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = isDark ? 0.95 : 0.75;
    ctx.fillStyle = `rgba(${r},${g},${b},1)`;
    ctx.beginPath();
    ctx.arc(px + Sx(12), py + ph / 2, Math.max(1.5, Math.min(Sx(3.4), Sy(3.4))), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = isDark ? 0.6 : 0.35;
    ctx.filter = `blur(${Math.max(2, Sy(5))}px)`;
    ctx.beginPath();
    ctx.arc(px + Sx(12), py + ph / 2, Math.max(1.5, Math.min(Sx(4.2), Sy(4.2))), 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();

    if (p.label) {
      ctx.save();
      ctx.fillStyle = isDark ? "rgba(235,240,248,0.90)" : "rgba(20,20,24,0.78)";
      ctx.font = `900 ${Math.round(Math.min(Sx(11), Sy(11)))}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.label, px + pw / 2, py + ph / 2);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.globalAlpha = isDark ? 0.45 : 0.25;
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  ctx.lineWidth = Math.max(1, Math.round(1 * dpr));
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  ctx.restore();
}

/* ---------------- Animation ---------------- */
let lastT = performance.now();
let animTime = 0;

function animate(t) {
  const dt = (t - lastT) / 1000;
  animTime += dt;
  lastT = t;

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < -10) p.x = BASE_W + 10;
    if (p.x > BASE_W + 10) p.x = -10;
    if (p.y < -10) p.y = BASE_H + 10;
    if (p.y > BASE_H + 10) p.y = -10;
  }

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

  try {
    drawFactory();
  } catch (e) {
    console.log("drawFactory error:", e);
  }

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

  tick();
  setInterval(tick, POLL_MS);

  checkBlocksBoot();

  await refreshPrice(currentRange);
  setInterval(() => refreshPrice(currentRange), 30_000);

  requestAnimationFrame(animate);
}

start();
