(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;

  /** Format a dollar amount compactly: $514.2M, $2.75B, $40.0K. */
  function fmtUsd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }

  /** Format a seven-day change: +5.6% in green, -2.2% in red. */
  function fmtPct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    return { text: s, cls: n >= 0 ? 'up' : 'down' };
  }

  /** Format an age in days: 1.5y, 8mo, 42d, or — when unknown. */
  function fmtAge(days) {
    if (days === null || days === undefined) return '—';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    if (days >= 30) return Math.round(days / 30) + 'mo';
    return days + 'd';
  }

  /** Format a multiple: 0.19x. */
  function fmtMult(n) { return n.toFixed(2) + 'x'; }

  /** Create an element with attributes and children. */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'class') node.className = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) {
        if (c === null || c === undefined) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  var state = { q: '', category: '', chain: '', minTvl: '', watchOnly: false, sort: 'rank', mode: 'pre', selected: null };

  function readHash() {
    var h = new URLSearchParams((location.hash || '').slice(1));
    state.q = h.get('q') || '';
    state.category = h.get('cat') || '';
    state.chain = h.get('chain') || '';
    state.minTvl = h.get('mintvl') || '';
    state.watchOnly = h.get('watch') === '1';
    state.sort = h.get('sort') || 'rank';
    state.mode = h.get('mode') === 'live' ? 'live' : 'pre';
    state.selected = h.get('row') || null;
  }

  function writeHash() {
    var h = new URLSearchParams();
    if (state.q) h.set('q', state.q);
    if (state.category) h.set('cat', state.category);
    if (state.chain) h.set('chain', state.chain);
    if (state.minTvl) h.set('mintvl', state.minTvl);
    if (state.watchOnly) h.set('watch', '1');
    if (state.sort !== 'rank') h.set('sort', state.sort);
    if (state.mode === 'live') h.set('mode', 'live');
    if (state.selected) h.set('row', state.selected);
    var s = h.toString();
    history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
  }

  /** The rows the board shows under the current filters. */
  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (state.category && (r.category || 'Other') !== state.category) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.minTvl && r.tvl_usd < Number(state.minTvl)) return false;
      if (q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  /** Sort the filtered rows by the current sort key. */
  function sortedRows(list) {
    var arr = list.slice();
    if (state.sort === 'tvl') arr.sort(function (a, b) { return b.tvl_usd - a.tvl_usd || a.rank - b.rank; });
    else if (state.sort === 'growth') arr.sort(function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0) || a.rank - b.rank; });
    else if (state.sort === 'cost') arr.sort(function (a, b) { return a.farm.total_usd - b.farm.total_usd || a.rank - b.rank; });
    else arr.sort(function (a, b) { return a.rank - b.rank; });
    return arr;
  }

  function verdictBadge(v) {
    return el('span', { class: 'badge ' + v.toLowerCase(), text: v });
  }

  /** Render the board table for the current state. */
  function renderBoard() {
    var tbody = document.querySelector('#board tbody');
    tbody.innerHTML = '';
    var rows = sortedRows(filteredRows());
    var shown = document.getElementById('shown');
    shown.textContent = rows.length + ' rows shown of ' + DATA.rows.length + ' on the board.';
    rows.forEach(function (r) {
      var tr = el('tr', { class: state.selected === r.slug ? 'sel' : '', 'data-slug': r.slug });
      tr.addEventListener('click', function () { state.selected = r.slug; writeHash(); render(); });
      var pct = fmtPct(r.change_7d);
      var cells = [
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', {}, [
          el('strong', { text: r.name }),
          el('div', { class: 'sub', text: r.slug + (r.watchlist ? ' · watchlist' : '') + ' · ' + r.chains.join(', ') }),
        ]),
        el('td', { text: r.category || 'Other' }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + pct.cls, text: pct.text }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num strong', text: fmtUsd(r.implied_value_usd) }),
        el('td', {}, [verdictBadge(r.farm.verdict)]),
        el('td', { class: 'num', text: r.rank_low + '–' + r.rank_high }),
      ];
      cells.forEach(function (c) { tr.appendChild(c); });
      tbody.appendChild(tr);
    });
  }

  /** Render the live-token table (the toggle's other view). */
  function renderLive() {
    var tbody = document.querySelector('#board tbody');
    tbody.innerHTML = '';
    var shown = document.getElementById('shown');
    shown.textContent = DATA.live.length + ' live tokens shown — the comps behind the multiples, not ranked with the board.';
    DATA.live.forEach(function (p) {
      var tr = el('tr', {});
      var pct = fmtPct(p.change_7d);
      var ratio = p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x' : '—';
      [
        el('td', { class: 'num', text: '—' }),
        el('td', {}, [
          el('strong', { text: p.name }),
          el('div', { class: 'sub', text: p.slug + ' · ' + p.chains.join(', ') }),
        ]),
        el('td', { text: p.category || 'Other' }),
        el('td', { class: 'num', text: fmtUsd(p.tvl_usd) }),
        el('td', { class: 'num ' + pct.cls, text: pct.text }),
        el('td', { class: 'num', text: '—' }),
        el('td', { class: 'num strong', text: fmtUsd(p.mcap_usd) }),
        el('td', {}, [el('span', { class: 'badge', text: 'live' })]),
        el('td', { class: 'num', text: ratio }),
      ].forEach(function (c) { tr.appendChild(c); });
    });
  }

  /** The detail panel for the selected row. */
  function renderDetail() {
    var body = document.getElementById('detailbody');
    var hint = document.getElementById('detailhint');
    body.innerHTML = '';
    var row = null;
    if (state.selected) {
      for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === state.selected) { row = DATA.rows[i]; break; }
    }
    if (!row) {
      hint.style.display = '';
      return;
    }
    hint.style.display = 'none';
    var pct = fmtPct(row.change_7d);
    var head = el('div', { class: 'detail-head' }, [
      el('div', {}, [
        el('h3', { text: '#' + row.rank + ' ' + row.name }),
        el('p', { class: 'sub', text: row.slug + ' · ' + (row.category || 'Other') + ' · ' + row.chains.join(', ') + (row.watchlist ? ' · watchlist' : '') }),
      ]),
      el('div', { class: 'detail-value' }, [
        el('div', { class: 'label', text: 'Implied value' }),
        el('div', { class: 'big', text: fmtUsd(row.implied_value_usd) }),
      ]),
    ]);
    body.appendChild(head);
    var terms = el('dl', { class: 'terms' });
    [
      ['TVL', fmtUsd(row.tvl_usd)],
      ['7-day change', pct.text],
      ['Age with no token', fmtAge(row.age_days)],
      ['Category multiple', fmtMult(row.category_multiple) + ' (' + row.category_samples + ' live comps)'],
      ['Growth multiplier', row.growth_multiplier.toFixed(3) + 'x'],
      ['Maturity multiplier', row.maturity_multiplier.toFixed(3) + 'x'],
      ['Rank in category', '#' + row.category_rank + ' of ' + (row.category || 'Other')],
      ['Rank range (80% of refits)', row.rank_low + '–' + row.rank_high + ' (median ' + row.rank_median + ')'],
    ].forEach(function (kv) {
      terms.appendChild(el('dt', { text: kv[0] }));
      terms.appendChild(el('dd', { text: kv[1] }));
    });
    body.appendChild(terms);
    var farm = row.farm;
    var cost = el('div', { class: 'farmcost' }, [
      el('h4', { text: 'Farm plan — ' + farm.verdict }),
      el('p', { class: 'note', text: 'Total cost ' + fmtUsd(farm.total_usd) + ' (gas ' + fmtUsd(farm.gas_usd) + ' · capital $' + farm.capital_usd + ' · forgone yield ' + fmtUsd(farm.forgone_yield_usd) + ' · time ' + farm.time_minutes + ' min worth ' + fmtUsd(farm.time_value_usd) + ') over a ' + farm.hold_days + '-day hold. Break-even airdrop ' + fmtUsd(farm.break_even_usd) + ' — ' + (farm.break_even_share * 100).toFixed(4) + '% of the implied value.' }),
    ]);
    body.appendChild(cost);
    var ol = el('ol', { class: 'steps' });
    row.farm_steps.forEach(function (s) { ol.appendChild(el('li', { text: s })); });
    body.appendChild(ol);
  }

  /** The category bar chart: total implied value by category, top 8. */
  function renderChart() {
    var totals = {};
    DATA.rows.forEach(function (r) {
      var c = r.category || 'Other';
      totals[c] = (totals[c] || 0) + r.implied_value_usd;
    });
    var top = Object.keys(totals).map(function (c) { return { c: c, v: totals[c] }; })
      .sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
    var max = top.length ? top[0].v : 1;
    var chart = document.getElementById('chart');
    chart.innerHTML = '';
    top.forEach(function (t) {
      var row = el('div', { class: 'bar-row' }, [
        el('span', { class: 'bar-label', text: t.c }),
        el('div', { class: 'bar-track' }, [el('div', { class: 'bar-fill', style: 'width:' + Math.max(2, (t.v / max) * 100).toFixed(1) + '%' })]),
        el('span', { class: 'bar-value', text: fmtUsd(t.v) }),
      ]);
      chart.appendChild(row);
    });
  }

  /** The leave-one-out calibration panel. */
  function renderCalibration() {
    var cal = DATA.calibration;
    var stats = document.getElementById('calstats');
    stats.innerHTML = '';
    [
      ['Rank agreement (Spearman ρ)', cal.spearman.toFixed(3)],
      ['Top decile found', cal.top_decile_hit + ' of ' + cal.top_decile_total],
      ['Median predicted / actual', cal.median_ratio.toFixed(2) + 'x'],
      ['Predicted within 2x of actual', Math.round(cal.within_2x * 100) + '%'],
    ].forEach(function (kv) {
      stats.appendChild(el('div', { class: 'stat' }, [
        el('div', { class: 'label', text: kv[0] }),
        el('div', { class: 'value', text: kv[1] }),
      ]));
    });
    var chance = (cal.top_decile_total / 10).toFixed(1);
    document.getElementById('calnote').textContent =
      'Of the ' + cal.top_decile_total + ' most valuable live protocols, ' + cal.top_decile_hit +
      ' land in the model\u2019s top decile — chance alone would put ' + chance +
      ' there. The model ranks value; it does not price it to the dollar. A single protocol\u2019s market cap can sit far from its category\u2019s median, and that dispersion is why the board is a ranking, not a price list.';
  }

  /** The method section: validation, term gating, size curve. */
  function renderMethod() {
    var wf = DATA.walk_forward;
    var boot = DATA.bootstrap;
    var val = document.getElementById('validation');
    val.innerHTML = '';
    var table = el('table', { class: 'mini' });
    var head = el('tr', {}, [el('th', { text: 'Check' }), el('th', { text: 'Result' }), el('th', { text: 'What it means' })]);
    table.appendChild(el('thead', {}, [head]));
    var body = el('tbody', {});
    [
      ['Leave-one-out (Spearman ρ)', DATA.calibration.spearman.toFixed(3) + ' on ' + DATA.calibration.n + ' live protocols', 'The model ranks live tokens about as well as the market does.'],
      ['Walk-forward (mean Spearman ρ)', wf.mean_spearman.toFixed(3) + ' across ' + wf.folds.length + ' folds', 'Multiples learned only from the past still rank what came next.'],
      ['Bootstrap rank range (median width)', String(boot.median_width) + ' ranks over ' + boot.refits + ' refits', boot.within_10 + ' rows sit within 10 ranks, ' + boot.within_25 + ' within 25.'],
    ].forEach(function (r) {
      body.appendChild(el('tr', {}, [el('td', { text: r[0] }), el('td', { class: 'num', text: r[1] }), el('td', { text: r[2] })]));
    });
    table.appendChild(body);
    val.appendChild(table);
    document.getElementById('gaterule').textContent = DATA.gating.rule;
    var gate = document.getElementById('gating');
    gate.innerHTML = '';
    var gt = el('table', { class: 'mini' });
    gt.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', { text: 'Term' }), el('th', { text: 'LOO with' }), el('th', { text: 'LOO without' }),
      el('th', { text: 'WF with' }), el('th', { text: 'WF without' }), el('th', { text: 'Verdict' }),
    ])]));
    var gb = el('tbody', {});
    DATA.gating.rows.forEach(function (r) {
      gb.appendChild(el('tr', {}, [
        el('td', { text: r.term }),
        el('td', { class: 'num', text: r.loo_with.toFixed(3) }),
        el('td', { class: 'num', text: r.loo_without.toFixed(3) }),
        el('td', { class: 'num', text: r.wf_with.toFixed(3) }),
        el('td', { class: 'num', text: r.wf_without.toFixed(3) }),
        el('td', { text: r.verdict }),
      ]));
    });
    gt.appendChild(gb);
    gate.appendChild(gt);
    var sc = DATA.size_curve;
    document.getElementById('sizecurve').textContent =
      'Size curve: a log-log fit of market cap against TVL scores LOO ' + sc.loo_spearman.toFixed(3) +
      ' and walk-forward ' + sc.wf_spearman.toFixed(3) + ', against a flat multiple at LOO ' +
      sc.flat_loo_spearman.toFixed(3) + ' and walk-forward ' + sc.flat_wf_spearman.toFixed(3) +
      '. The curve does ' + (sc.beats_flat ? '' : 'not ') + 'beat the flat multiple, so the model does not use one.';
  }

  /** The live-token table at the bottom of the page. */
  function renderLiveTable() {
    var tbody = document.querySelector('#live tbody');
    tbody.innerHTML = '';
    DATA.live.forEach(function (p) {
      var pct = fmtPct(p.change_7d);
      var ratio = p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x' : '—';
      var tr = el('tr', {});
      tr.appendChild(el('td', {}, [el('strong', { text: p.name }), el('div', { class: 'sub', text: p.slug })]));
      tr.appendChild(el('td', { text: p.category || 'Other' }));
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(p.tvl_usd) }));
      tr.appendChild(el('td', { class: 'num', text: fmtUsd(p.mcap_usd) }));
      tr.appendChild(el('td', { class: 'num', text: ratio }));
      tr.appendChild(el('td', { class: 'num ' + pct.cls, text: pct.text }));
      tbody.appendChild(tr);
    });
  }

  /** Header, lede and KPI cards. */
  function renderHead() {
    document.getElementById('asof').textContent = 'Snapshot ' + DATA.as_of;
    document.getElementById('source').textContent = DATA.source.replace(/^https?:\/\//, '');
    document.getElementById('modelver').textContent = DATA.model_version + ' model';
    var cov = DATA.coverage;
    document.getElementById('ledehead').textContent = cov.watchlist + ' watchlist protocols, ranked by implied value';
    var top = DATA.rows[0];
    document.getElementById('topline').textContent = top
      ? 'Top of the board: ' + top.name + ' at ' + fmtUsd(top.implied_value_usd) + ' implied value.'
      : '';
    var kpi = document.getElementById('kpi');
    kpi.innerHTML = '';
    [
      ['Watchlist covered', cov.watchlist + ' / ' + cov.watchlist],
      ['Pre-token rows scored', String(cov.board)],
      ['Early rows below the floor', String(cov.early_below_floor)],
      ['Live-token protocols set aside', String(cov.live_shown)],
    ].forEach(function (kv) {
      kpi.appendChild(el('div', { class: 'stat' }, [
        el('div', { class: 'label', text: kv[0] }),
        el('div', { class: 'value', text: kv[1] }),
      ]));
    });
    document.getElementById('boardcount').textContent = '· ' + DATA.rows.length + ' rows · ' + cov.watchlist + ' watchlist · ' + cov.early_below_floor + ' early below the $50M floor · ' + cov.early_above_floor + ' early above it';
  }

  /** Fill the filter selects. */
  function renderFilters() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var catSel = document.getElementById('cat');
    cats.forEach(function (c) { catSel.appendChild(el('option', { value: c, text: c })); });
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var chainSel = document.getElementById('chain');
    chains.forEach(function (c) { chainSel.appendChild(el('option', { value: c, text: c })); });
  }

  /** Sync the controls with the state. */
  function syncControls() {
    document.getElementById('q').value = state.q;
    document.getElementById('cat').value = state.category;
    document.getElementById('chain').value = state.chain;
    document.getElementById('mintvl').value = state.minTvl;
    document.getElementById('watchonly').checked = state.watchOnly;
    document.getElementById('sort').value = state.sort;
    document.getElementById('prebtn').classList.toggle('on', state.mode === 'pre');
    document.getElementById('livebtn').classList.toggle('on', state.mode === 'live');
    document.querySelector('#board thead tr').children[8].textContent = state.mode === 'live' ? 'Ratio' : 'Rank range';
  }

  function render() {
    syncControls();
    if (state.mode === 'live') renderLive(); else renderBoard();
    renderDetail();
  }

  function bind() {
    document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; writeHash(); render(); });
    document.getElementById('cat').addEventListener('change', function (e) { state.category = e.target.value; writeHash(); render(); });
    document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; writeHash(); render(); });
    document.getElementById('mintvl').addEventListener('change', function (e) { state.minTvl = e.target.value; writeHash(); render(); });
    document.getElementById('watchonly').addEventListener('change', function (e) { state.watchOnly = e.target.checked; writeHash(); render(); });
    document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; writeHash(); render(); });
    document.getElementById('prebtn').addEventListener('click', function () { state.mode = 'pre'; writeHash(); render(); });
    document.getElementById('livebtn').addEventListener('click', function () { state.mode = 'live'; writeHash(); render(); });
    window.addEventListener('hashchange', function () { readHash(); render(); });
  }

  readHash();
  renderHead();
  renderFilters();
  renderChart();
  renderCalibration();
  renderMethod();
  renderLiveTable();
  bind();
  render();
})();
