import "./style.css";

const FEED_LIMIT = 50;
const POLL_MS = 4000;
const API_BASE = "https://mempool.space/api";

const feedEl = document.getElementById("feed");
const statusEl = document.getElementById("status");
const pauseBtn = document.getElementById("pauseBtn");

let paused = false;
let seen = new Set();

pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Weiter" : "Pause";
  statusEl.textContent = paused ? "Pausiert" : "Läuft…";
});

function shortTxid(txid) {
  return txid ? txid.slice(0, 10) + "…" + txid.slice(-6) : "";
}

function nowTime() {
  return new Date().toLocaleTimeString();
}

function addItem({ txid, fee, vsize }) {
  const feeRate = (fee && vsize) ? (fee / vsize) : null;
  const li = document.createElement("li");
  li.className = "item";

  li.innerHTML = `
    <div class="meta">
      <span>${nowTime()}</span>
      <span class="txid" title="${txid}">${shortTxid(txid)}</span>
      ${feeRate !== null ? `<span>~ ${feeRate.toFixed(1)} sat/vB</span>` : `<span>fee-rate n/a</span>`}
      ${vsize ? `<span>${vsize} vB</span>` : `<span>vsize n/a</span>`}
    </div>
  `;

  feedEl.prepend(li);

  while (feedEl.children.length > FEED_LIMIT) {
    feedEl.removeChild(feedEl.lastChild);
  }
}

async function fetchRecent() {
  const res = await fetch(`${API_BASE}/mempool/recent`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function tick() {
  if (paused) return;
  try {
    statusEl.textContent = "Lädt…";
    const txs = await fetchRecent();

    for (const tx of txs) {
      const txid = tx.txid || tx.txId || tx.hash;
      if (!txid) continue;
      if (seen.has(txid)) continue;
      seen.add(txid);

      const fee = tx.fee ?? tx.fees;
      const vsize = tx.vsize ?? tx.virtualSize ?? tx.size;

      addItem({ txid, fee, vsize });
    }

    statusEl.textContent = `OK • letzte Aktualisierung ${nowTime()}`;
  } catch (e) {
    statusEl.textContent = `Fehler: ${e.message}`;
  }
}

tick();
setInterval(tick, POLL_MS);
