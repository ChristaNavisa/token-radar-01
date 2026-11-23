// Token Radar's dashboard (radar-10): a static page, no framework, no network.
// It reads window.RADAR from data.js — written by main.ts from the same board
// the gate checks — and renders the board, the detail view, the method panel
// and the live-token view. The hash drives the view: #p=<slug> opens a detail,
// #sort=<key> sorts the board, #q=<text> searches, #cat=<category> filters,
// #wl=1 shows the watchlist only.

const D = window.RADAR;

const $ = (id) => document.getElementById(id);
const money = (n) => {
  if (n === null || n === undefined) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
};
const moneyFull = (n) => '$' + Math.round(n).toLocaleString('en-US');
const pct = (n) => (n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%');
const ageText = (d) => (d === null || d === undefined ? 'unknown' : d + 'd');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The hash as a plain object: #p=slug&sort=tvl&wl=1. */
function hashParams() {
  const out = {};
  for (const part of location.hash.slice(1).split('&')) {
    if (!part) continue;
    const [k, v] = part.split('=');
    out[decodeURIComponent(k)] = v === undefined ? '' : decodeURIComponent(v);
  }
  return out;
}

function setHash(patch) {
  const cur = hashParams();
  const next = { ...cur, ...patch };
  for (const k of Object.keys(next)) if (next[k] === '' || next[k] === undefined) delete next[k];
  const h = Object.entries(next).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
}

/* ---------- headline numbers ---------- */

function renderStats() {
  $('modelVersion').textContent = D.model_version;
  $('modelVersion2').textContent = D.model_version;
  $('asOf').textContent = D.as_of;
  $('sourceLine').textContent = D.source;
  const top = D.rows[0];
  $('stats').innerHTML = [
    [D.board_size, 'protocols on the board'],
    [D.watchlist_size, 'on the watchlist'],
    [D.calibration.spearman.toFixed(3), 'leave-one-out Spearman'],
    [D.walk_forward.mean_spearman.toFixed(3), 'walk-forward mean Spearman'],
    [D.bootstrap.median_width, 'bootstrap median rank width'],
    [top ? money(top.implied_value_usd) : '—', top ? '#1 ' + top.name : 'top implied value'],
  ].map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');
}

/* ---------- method panel ---------- */

function renderMethod() {
  const c = D.calibration;
  const w = D.walk_forward;
  const b = D.bootstrap;
  const s = D.size_curve;
  const card = (title, big, note) =>
    `<div class="checkcard"><b>${esc(title)}</b><div class="big">${esc(big)}</div><span>${esc(note)}</span></div>`;
  $('methodChecks').innerHTML = `<div class="checkgrid">` +
    card('Leave-one-out', c.spearman.toFixed(3),
      `128 live tokens scored as if they had none. Top decile ${c.top_decile_hit}/${c.top_decile_total} · median ratio ${c.median_ratio.toFixed(2)} · within 2x ${Math.round(c.within_2x * 100)}%`) +
    card('Walk-forward', w.mean_spearman.toFixed(3),
      w.folds.map((f) => `${f.cutoff}: ${f.spearman.toFixed(3)} (${f.future_n} after)`).join(' · ')) +
    card('Bootstrap', '±' + Math.round(b.median_width / 2) + ' ranks',
      `${b.refits} refits of the multiples. ${b.within_10} of ${D.board_size} rows sit within 10 ranks, ${b.within_25} within 25.`) +
    card('Size curve', s.beats_flat ? 'beats flat' : 'rejected',
      `Log-log fit LOO ${s.loo_spearman.toFixed(3)} / WF ${s.wf_spearman.toFixed(3)} against a flat multiple ${s.flat_loo_spearman.toFixed(3)} / ${s.flat_wf_spearman.toFixed(3)} — the curve loses, so the model does not use one.`) +
    `</div>`;
  $('gatingNote').textContent =
    'Term gating — ' + D.gating.rule + ' ' +
    D.gating.rows.map((r) => `${r.term}: LOO ${r.loo_with.toFixed(3)}→${r.loo_without.toFixed(3)}, WF ${r.wf_with.toFixed(3)}→${r.wf_without.toFixed(3)} (${r.verdict})`).join('; ') + '.';
  const cats = Object.keys(D.category_multiples).sort((a, b) => D.category_multiples[b].multiple - D.category_multiples[a].multiple);
  $('multiplesTable').innerHTML = `<div class="tablewrap"><table><thead><tr><th>Category</th><th class="num">Multiple</th><th class="num">Samples</th><th>Anchors (traded, by TVL)</th></tr></thead><tbody>` +
    cats.map((cat) => {
      const m = D.category_multiples[cat];
      const anchors = (D.anchors[cat] || []).map((a) => `${esc(a.name)} ${a.ratio.toFixed(2)}x`).join(', ');
      return `<tr><td>${esc(cat)}</td><td class="num">${m.multiple.toFixed(3)}x</td><td class="num">${m.samples}</td><td>${anchors || '—'}</td></tr>`;
    }).join('') + `</tbody></table></div>`;
}

/* ---------- the board ---------- */

const SORTS = {
  implied: (a, b) => a.rank - b.rank,
  tvl: (a, b) => b.tvl_usd - a.tvl_usd,
  growth: (a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9),
  age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1),
  multiple: (a, b) => b.category_multiple - a.category_multiple,
};

function boardRows() {
  const h = hashParams();
  const q = (h.q || '').toLowerCase();
  const cat = h.cat || '';
  const wl = h.wl === '1';
  const sort = SORTS[h.sort] ? h.sort : 'implied';
  let rows = D.rows.filter((r) =>
    (!q || r.name.toLowerCase().includes(q) || r.slug.includes(q)) &&
    (!cat || r.category === cat) &&
    (!wl || r.watchlist));
  return { rows: [...rows].sort(SORTS[sort]), sort };
}

function renderBoard() {
  const h = hashParams();
  const { rows, sort } = boardRows();
  $('boardCount').textContent =
    `${D.board_size} rows: ${D.watchlist_size} watchlist + ${D.early_size} early below the $${(D.floor_usd / 1e6).toFixed(0)}M floor` +
    (rows.length !== D.board_size ? ` — ${rows.length} shown by the current filter` : '') + '.';
  $('searchBox').value = h.q || '';
  $('sortSelect').value = sort;
  $('watchlistOnly').checked = h.wl === '1';
  const sel = $('categorySelect');
  if (sel.options.length <= 1) {
    const cats = [...new Set(D.rows.map((r) => r.category).filter(Boolean))].sort();
    for (const c of cats) sel.add(new Option(c, c));
  }
  sel.value = h.cat || '';
  const picked = h.p;
  $('board').querySelector('tbody').innerHTML = rows.map((r) => `
    <tr data-slug="${esc(r.slug)}" class="${r.slug === picked ? 'picked' : ''}">
      <td class="num">${r.rank}</td>
      <td class="namecell"><b>${esc(r.name)}${r.watchlist ? '<span class="badge wl">watchlist</span>' : ''}</b><span>${esc(r.slug)}</span></td>
      <td>${esc(r.category || '—')}</td>
      <td class="num">${money(r.tvl_usd)}</td>
      <td class="num">${pct(r.change_7d)}</td>
      <td class="num">${ageText(r.age_days)}</td>
      <td class="num"><b>${money(r.implied_value_usd)}</b></td>
      <td class="num">${r.category_multiple.toFixed(2)}x</td>
      <td><span class="badge ${r.farm.verdict.toLowerCase()}">${r.farm.verdict}</span></td>
    </tr>`).join('');
  for (const tr of $('board').querySelectorAll('tbody tr')) {
    tr.addEventListener('click', () => { setHash({ p: tr.dataset.slug }); renderAll(); scrollToDetail(); });
  }
}

function scrollToDetail() {
  $('detailPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- detail ---------- */

function renderDetail() {
  const slug = hashParams().p;
  const box = $('detailBody');
  if (!slug) { box.innerHTML = '<p class="muted">Pick a row on the board to see its detail here.</p>'; return; }
  const r = D.rows.find((x) => x.slug === slug);
  if (!r) { box.innerHTML = '<p class="muted">No protocol with that slug is on the board.</p>'; return; }
  const anchors = (D.anchors[r.category] || []);
  const f = r.farm;
  box.innerHTML = `
    <div class="detail-head">
      <h3>#${r.rank} ${esc(r.name)}</h3>
      <span class="sub">${esc(r.category || '—')} · ${r.chains.map(esc).join(', ') || 'no chain listed'}${r.watchlist ? ' · watchlist' : ''} · #${r.category_rank} in its category</span>
    </div>
    <p class="muted">Implied value ${moneyFull(r.implied_value_usd)} — the value a token would carry if this protocol's record held.</p>
    <div class="modelgrid">
      <div class="modelcell"><b>${money(r.tvl_usd)}</b><span>TVL</span></div>
      <div class="modelcell"><b>${r.category_multiple.toFixed(3)}x</b><span>category multiple (${r.category_samples} traded samples)</span></div>
      <div class="modelcell"><b>${pct(r.change_7d)}</b><span>7-day change → ${r.growth_multiplier.toFixed(3)}x</span></div>
      <div class="modelcell"><b>${ageText(r.age_days)}</b><span>age → ${r.maturity_multiplier.toFixed(3)}x</span></div>
      <div class="modelcell"><b>${moneyFull(f.total_usd)}</b><span>farm plan cost, all in</span></div>
      <div class="modelcell"><b>${(f.break_even_share * 100).toFixed(4)}%</b><span>break-even share — verdict ${f.verdict}</span></div>
    </div>
    <p class="costline">Farm cost: gas $${f.gas_usd} · capital $${f.capital_usd} for ${f.hold_days} days · forgone yield $${f.forgone_yield_usd} · time ${f.time_minutes} min ($${f.time_value_usd}). Break-even airdrop ${moneyFull(f.break_even_usd)}.</p>
    <h4>Farm plan</h4>
    <ol class="farmsteps">${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    ${anchors.length ? `<h4>Traded anchors in ${esc(r.category)}</h4><ul class="anchorlist">${anchors.map((a) => `<li>${esc(a.name)} — TVL ${money(a.tvl_usd)}, market cap ${money(a.mcap_usd)}, ${a.ratio.toFixed(2)}x</li>`).join('')}</ul>` : ''}`;
}

/* ---------- live view ---------- */

function renderLive() {
  $('liveTable').querySelector('tbody').innerHTML = D.live.map((p) => `
    <tr>
      <td class="namecell"><b>${esc(p.name)}</b><span>${esc(p.slug)}</span></td>
      <td>${esc(p.category || '—')}</td>
      <td class="num">${money(p.tvl_usd)}</td>
      <td class="num">${money(p.mcap_usd)}</td>
      <td class="num">${p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x' : '—'}</td>
      <td class="num">${pct(p.change_7d)}</td>
    </tr>`).join('');
}

/* ---------- wiring ---------- */

function renderAll() { renderStats(); renderMethod(); renderBoard(); renderDetail(); renderLive(); }

$('searchBox').addEventListener('input', (e) => { setHash({ q: e.target.value }); renderBoard(); });
$('categorySelect').addEventListener('change', (e) => { setHash({ cat: e.target.value }); renderBoard(); });
$('sortSelect').addEventListener('change', (e) => { setHash({ sort: e.target.value }); renderBoard(); });
$('watchlistOnly').addEventListener('change', (e) => { setHash({ wl: e.target.checked ? '1' : '' }); renderBoard(); });
window.addEventListener('hashchange', renderAll);

renderAll();
