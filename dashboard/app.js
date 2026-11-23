// Token Radar's dashboard, model radar-8. It reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the ranked board, a filterable table, a
// per-protocol detail view with the model's own inputs and the protocol's farm
// plan, the leave-one-out and walk-forward checks, the term-gating table, the
// size-curve test, the bootstrap rank ranges, and the live tokens the multiples
// come from. No network: every byte it shows is in data.js.
//
// The value a row shows is the one main.ts computed, from the snapshot figures:
//   implied = round(tvl x category_multiple x growth_term x maturity_term)
//   growth_term = 1 + 0.10 x sign(g) x ln(1 + |g|/100), g = clamp(change_7d,-60,120)
//   maturity_term = 0.6 + min(age_days,1095)/1095 x 0.02
// The category multiple is the category's trimmed mean market-cap-to-TVL ratio
// — the mean of the log ratios with the top and bottom 10% cut, exponentiated —
// shrunk toward the global median with a pseudo-count of 10, then clamped to
// at most 0.4x. Ratios past 10x or below 0.001x are left out of the learning.
// Every category multiple names the traded tokens that anchor it — the live
// protocols whose ratios taught it, biggest first — so the reader sees what the
// multiple rests on. The launch odds are the share of peer protocols (same age
// band, same category) that already have a token, shrunk toward the global rate.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n, digits) {
    if (n === null || n === undefined) return '—';
    return (n * 100).toFixed(digits === undefined ? 1 : digits) + '%';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---- header ----
  $('asof').textContent = 'Snapshot ' + DATA.as_of;
  $('source').textContent = DATA.source;
  $('modelver').textContent = 'Model ' + DATA.model_version;

  var c = DATA.coverage;
  var kpi = $('kpi');
  kpi.innerHTML =
    '<div class="stat"><span>Protocols</span><b>' + c.total + '</b></div>' +
    '<div class="stat"><span>Live tokens</span><b>' + c.live + '</b></div>' +
    '<div class="stat"><span>Pre-token</span><b>' + c.pre_token + '</b></div>' +
    '<div class="stat"><span>Board rows</span><b>' + c.board + '</b></div>' +
    '<div class="stat"><span>LOO Spearman</span><b>' + DATA.calibration.spearman + '</b></div>' +
    '<div class="stat"><span>Walk-forward</span><b>' + DATA.walk_forward.mean_spearman + '</b></div>' +
    '<div class="stat"><span>Top-decile hit</span><b>' + DATA.calibration.top_decile_hit + '/' + DATA.calibration.top_decile_total + '</b></div>' +
    '<div class="stat"><span>Bootstrap width</span><b>' + DATA.bootstrap.median_width + '</b></div>';
  $('boardcount').textContent = '· ' + c.board + ' rows · ' + c.watchlist + ' watchlist · ' + c.early_below_floor + ' early below the $' + (DATA.floor_usd / 1e6) + 'M floor · ' + c.early_above_floor + ' early above it';

  // ---- validation ----
  var v = $('validation');
  var wfRows = DATA.walk_forward.folds.map(function (f) {
    return '<tr><td>' + f.cutoff + '</td><td class="num">' + f.past_n + '</td><td class="num">' + f.future_n + '</td><td class="num">' + f.spearman + '</td><td class="num">' + f.top_decile_hit + '/' + f.top_decile_total + '</td><td class="num">' + f.median_ratio + '×</td></tr>';
  }).join('');
  v.innerHTML =
    '<div class="valgrid">' +
    '<div class="stat"><span>Leave-one-out Spearman</span><b>' + DATA.calibration.spearman + '</b><small>n = ' + DATA.calibration.n + ' live protocols, top decile ' + DATA.calibration.top_decile_hit + '/' + DATA.calibration.top_decile_total + ', median ratio ' + DATA.calibration.median_ratio + '×, within 2× ' + pct(DATA.calibration.within_2x, 0) + '</small></div>' +
    '<div class="stat"><span>Walk-forward mean</span><b>' + DATA.walk_forward.mean_spearman + '</b><small>three cuts, learned only from protocols listed before each cut</small></div>' +
    '<div class="stat"><span>Bootstrap rank range</span><b>' + DATA.bootstrap.median_width + '</b><small>median width over ' + DATA.bootstrap.refits + ' refits; ' + DATA.bootstrap.within_10 + ' rows within 10, ' + DATA.bootstrap.within_25 + ' within 25</small></div>' +
    '<div class="stat"><span>Coverage</span><b>' + c.total + '</b><small>' + c.live + ' live · ' + c.zero_mcap + ' token, no cap · ' + c.token_no_mcap + ' token signal, no cap · ' + c.pre_token + ' pre-token (' + c.board + ' ranked, ' + c.excluded_by_rule + ' excluded by the watchlist rule)</small></div>' +
    '</div>' +
    '<table class="gate"><thead><tr><th>Walk-forward cut</th><th class="num">Learned from</th><th class="num">Scored on</th><th class="num">Spearman</th><th class="num">Top decile</th><th class="num">Median ratio</th></tr></thead><tbody>' + wfRows + '</tbody></table>';
  $('gaterule').textContent = 'Term gating — ' + DATA.gating.rule;
  $('gating').innerHTML = '<table class="gate"><thead><tr><th>Term removed</th><th class="num">LOO with</th><th class="num">LOO without</th><th class="num">WF with</th><th class="num">WF without</th><th>Verdict</th></tr></thead><tbody>' +
    DATA.gating.rows.map(function (r) {
      return '<tr><td>' + esc(r.term) + '</td><td class="num">' + r.loo_with + '</td><td class="num">' + r.loo_without + '</td><td class="num">' + r.wf_with + '</td><td class="num">' + r.wf_without + '</td><td>' + r.verdict + '</td></tr>';
    }).join('') + '</tbody></table>';
  var sc = DATA.size_curve;
  $('sizecurve').textContent = 'Size curve — a log-log fit of market cap against TVL scores LOO ' + sc.loo_spearman + ' and walk-forward ' + sc.wf_spearman + ', against a flat multiple at LOO ' + sc.flat_loo_spearman + ' and walk-forward ' + sc.flat_wf_spearman + '. The curve does ' + (sc.beats_flat ? '' : 'not ') + 'beat a flat multiple, so the model does not use one.';

  // ---- board ----
  var rows = DATA.rows;
  var catSel = $('cat');
  var cats = [];
  rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) === -1) cats.push(r.category); });
  cats.sort().forEach(function (cat) {
    var o = document.createElement('option');
    o.value = cat; o.textContent = cat;
    catSel.appendChild(o);
  });

  var state = { q: '', cat: '', verdict: '', watch: false, minodds: 0, sort: 'rank', selected: null };

  function filtered() {
    var q = state.q.toLowerCase();
    var out = rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) === -1 && r.slug.toLowerCase().indexOf(q) === -1) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.verdict && r.farm.verdict !== state.verdict) return false;
      if (state.watch && !r.watchlist) return false;
      if (r.launch_odds < state.minodds) return false;
      return true;
    });
    var key = state.sort;
    out.sort(function (a, b) {
      if (key === 'expected') return b.expected_value_usd - a.expected_value_usd;
      if (key === 'odds') return b.launch_odds - a.launch_odds;
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (key === 'cost') return a.farm.total_usd - b.farm.total_usd;
      return a.rank - b.rank;
    });
    return out;
  }

  function renderBoard() {
    var list = filtered();
    var tb = document.querySelector('#board tbody');
    tb.innerHTML = list.map(function (r) {
      var chg = r.change_7d === null ? '—' : (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%';
      var cls = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' data-selected="true"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td class="name"><b>' + esc(r.name) + '</b><span class="sub">' + esc(r.slug) + (r.watchlist ? ' · watchlist' : '') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + ' <span class="' + cls + '">' + chg + '</span></td>' +
        '<td class="num">' + money(r.implied_value_usd) + '</td>' +
        '<td class="num">' + pct(r.launch_odds, 0) + '</td>' +
        '<td class="num">' + money(r.expected_value_usd) + '</td>' +
        '<td><span class="pill ' + r.farm.verdict.toLowerCase() + '">' + r.farm.verdict + '</span></td>' +
        '<td class="num">' + r.rank_low + '–' + r.rank_high + '</td></tr>';
    }).join('');
    $('shown').textContent = 'Showing ' + list.length + ' of ' + rows.length + ' rows. Click a row for its detail.';
  }

  function renderDetail(slug) {
    var r = null;
    rows.forEach(function (x) { if (x.slug === slug) r = x; });
    var body = $('detailbody');
    if (!r) { body.innerHTML = ''; return; }
    var anchors = (DATA.anchors[r.category] || []).map(function (a) {
      return '<div><span>' + esc(a.name) + ' (' + esc(a.slug) + ')</span><b>' + a.ratio.toFixed(3) + '×</b></div>';
    }).join('');
    var steps = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var f = r.farm;
    body.innerHTML =
      '<h3>#' + r.rank + ' ' + esc(r.name) + ' <span class="pill ' + (r.watchlist ? 'watch' : '') + '">' + (r.watchlist ? 'watchlist' : 'early') + '</span></h3>' +
      '<div class="detail-grid">' +
      '<div><h3>Model terms</h3><div class="kv">' +
      '<div><span>TVL</span><b>' + money(r.tvl_usd) + '</b></div>' +
      '<div><span>Category multiple</span><b>' + r.category_multiple.toFixed(3) + '× (' + r.category_samples + ' live tokens)</b></div>' +
      '<div><span>Growth multiplier</span><b>' + r.growth_multiplier.toFixed(3) + '×</b></div>' +
      '<div><span>Maturity multiplier</span><b>' + r.maturity_multiplier.toFixed(3) + '×</b></div>' +
      '<div><span>Age</span><b>' + (r.age_days === null ? 'unknown' : r.age_days + ' days') + '</b></div>' +
      '<div><span>Implied value</span><b>' + money(r.implied_value_usd) + '</b></div>' +
      '<div><span>Category rank</span><b>#' + r.category_rank + ' in ' + esc(r.category || '—') + '</b></div>' +
      '<div><span>Rank range (80%)</span><b>' + r.rank_low + '–' + r.rank_high + ' (median ' + r.rank_median + ')</b></div>' +
      '</div>' +
      '<h3 style="margin-top:14px">Traded tokens anchoring the multiple</h3><div class="kv">' + (anchors || '<div><span>None in this category</span><b>—</b></div>') + '</div></div>' +
      '<div><h3>Launch odds</h3><div class="kv">' +
      '<div><span>Launch odds</span><b>' + pct(r.launch_odds, 1) + '</b></div>' +
      '<div><span>Expected value</span><b>' + money(r.expected_value_usd) + '</b></div>' +
      '</div>' +
      '<h3 style="margin-top:14px">Farm cost</h3><div class="kv">' +
      '<div><span>Gas</span><b>$' + f.gas_usd.toFixed(2) + '</b></div>' +
      '<div><span>Capital</span><b>$' + f.capital_usd + ' for ' + f.hold_days + ' days</b></div>' +
      '<div><span>Time</span><b>' + f.time_minutes + ' min ($' + f.time_value_usd.toFixed(2) + ')</b></div>' +
      '<div><span>Forgone yield</span><b>$' + f.forgone_yield_usd.toFixed(2) + '</b></div>' +
      '<div><span>Total cost</span><b>$' + f.total_usd.toFixed(2) + '</b></div>' +
      '<div><span>Break-even airdrop</span><b>$' + f.break_even_usd.toFixed(2) + '</b></div>' +
      '<div><span>Verdict</span><b>' + f.verdict + '</b></div>' +
      '</div></div>' +
      '</div>' +
      '<h3 style="margin-top:14px">Farm plan — 8 steps</h3><ol class="steps">' + steps + '</ol>';
    $('detailhint').textContent = '';
  }

  document.querySelector('#board tbody').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.selected = tr.getAttribute('data-slug');
    renderBoard();
    renderDetail(state.selected);
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderBoard(); });
  $('verdict').addEventListener('change', function (e) { state.verdict = e.target.value; renderBoard(); });
  $('watchonly').addEventListener('change', function (e) { state.watch = e.target.checked; renderBoard(); });
  $('minodds').addEventListener('input', function (e) { state.minodds = parseFloat(e.target.value) || 0; renderBoard(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });

  renderBoard();

  // ---- live tokens ----
  var lt = document.querySelector('#live tbody');
  lt.innerHTML = DATA.live.map(function (p) {
    var ratio = p.tvl_usd > 0 ? (p.mcap_usd / p.tvl_usd) : 0;
    var chg = p.change_7d === null ? '—' : (p.change_7d >= 0 ? '+' : '') + p.change_7d.toFixed(1) + '%';
    var cls = p.change_7d === null ? '' : (p.change_7d >= 0 ? 'pos' : 'neg');
    return '<tr><td class="name"><b>' + esc(p.name) + '</b><span class="sub">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + ratio.toFixed(3) + '×</td>' +
      '<td class="num"><span class="' + cls + '">' + chg + '</span></td></tr>';
  }).join('');

  // Deep links: #p=<slug> opens a protocol's detail; #sort=<key> sets the sort;
  // #cat=<category> filters by category; #watch=1 shows the watchlist only.
  // Read after the first render, so a shared link lands on the same view.
  var hash = new URLSearchParams(location.hash.slice(1));
  var p = hash.get('p');
  var sort = hash.get('sort');
  var cat = hash.get('cat');
  var watch = hash.get('watch');
  if (sort && ['rank', 'expected', 'odds', 'tvl', 'cost'].indexOf(sort) !== -1) {
    state.sort = sort;
    $('sort').value = sort;
  }
  if (cat) { state.cat = cat; $('cat').value = cat; }
  if (watch === '1') { state.watch = true; $('watchonly').checked = true; }
  if (p) { state.selected = p; }
  renderBoard();
  if (p) {
    renderDetail(p);
    $('detail').scrollIntoView();
  }
})();
