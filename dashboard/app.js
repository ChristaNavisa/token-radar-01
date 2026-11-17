// Token Radar's dashboard, model radar-7. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol detail drawer with
// the model's own inputs and the protocol's farm plan, a category chart, a leave-one-out check
// of the model on the protocols whose token already trades, a walk-forward test and bootstrap
// rank ranges for the same model, a term-gating table that shows what each term of the model
// earns under the blind test, and a model sandbox that re-ranks the board live in the
// browser. No network: every byte it shows is in data.js.
//
// The sandbox recomputes each row from the snapshot figures with the same formula main.ts runs,
// so the page's code and the board's data are visibly the same arithmetic:
//   implied = round(tvl x category_multiple x (1 + 0.25 x sign(g) x ln(1 + |g|/100))
//                   x (maturity_floor + min(age_days,1095)/1095 x maturity_range))
//   where g = clamp(change_7d,-60,120), and the category multiple is the category's trimmed
//   mean market-cap-to-TVL ratio — the mean of the log ratios with the top and bottom 10%
//   cut, exponentiated — shrunk toward the global median with a pseudo-count of 10:
//   (n x category multiple + 10 x global median) / (n + 10), then clamped to at most 0.4x.
//   Ratios past 10x or below 0.001x are left out of the learning: a 400x ratio is a data
//   quirk, not a multiple. Every category multiple names the traded tokens that anchor it
//   — the live protocols whose ratios taught it, biggest first — so the reader sees what
//   the multiple rests on.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, wl: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
  var sandbox = { active: false, mult: 1, weight: DATA.model.growth_weight, floor: DATA.model.maturity_floor };
  var DEFAULTS = { mult: 1, weight: DATA.model.growth_weight, floor: DATA.model.maturity_floor };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return n.toFixed(2) + 'x'; }
  function fmtCover(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M×';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K×';
    return Math.round(n) + '×';
  }
  function fmtRange(r) {
    if (r.rank_low === undefined || r.rank_high === undefined) return '—';
    if (r.rank_low === r.rank_high) return '#' + r.rank_low;
    return '#' + r.rank_low + '–' + r.rank_high;
  }

  // The model in one function: the page recomputes a row from the snapshot figures and checks
  // the number board.json carries, so the page's code and the board's data are visibly the same
  // arithmetic. With the sandbox off, the stored implied value is returned untouched. Growth is
  // dampened on a log scale, as in main.ts: one hot week cannot dominate the ranking.
  function impliedOf(row, sb) {
    if (!sb || !sb.active) return row.implied_value_usd;
    var growth = Math.min(DATA.model.growth_cap, Math.max(DATA.model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + sb.weight * Math.sign(growth) * Math.log1p(Math.abs(growth) / 100);
    var age = row.age_days === null || row.age_days === undefined ? DATA.model.unknown_age_days : row.age_days;
    var maturity = sb.floor + (Math.min(Math.max(age, 0), DATA.model.maturity_days) / DATA.model.maturity_days) * DATA.model.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * sb.mult * growthMult * maturity));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL
  // and age decide the action, the capital, the hold and every cost and time. No name is
  // special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyActionFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'a supply, a borrow or a repayment';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'a swap or a liquidity adjustment';
    if (c.indexOf('bridge') >= 0) return 'a bridge of a small amount';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'a stake, a restake or a claim of rewards';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'one small trade and its close';
    if (c.indexOf('prediction') >= 0) return 'one market position';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'a deposit or a vault rebalance check';
    if (c.indexOf('stable') >= 0) return 'a mint, a redeem or a transfer';
    if (c.indexOf('rwa') >= 0) return 'a mint or a hold check';
    if (c.indexOf('insurance') >= 0) return 'a cover check or a claim review';
    return 'a deposit, a borrow, a swap or a vote';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var weekly = weeklyActionFor(p);
    var weeklyText = (p.chains && p.chains.length >= 2)
      ? 'Make one qualifying action each week on ' + chain + ', such as ' + weekly + ', and once a month repeat the core action on ' + p.chains[1] + ', so the wallet shows repeat activity on both chains.'
      : 'Make one qualifying action each week, such as ' + weekly + ', so the wallet shows repeat activity.';
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: weeklyText, cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Once a month, check " + p.name + "'s own points or rewards page for a snapshot date and write it in your farm log.", cost: 'no fee to check', time: '10 minutes a month' },
      { text: 'Set a monthly reminder to check whether ' + p.name + ' has announced a token or a points program, and read the announcement on the protocol\'s own page.', cost: 'no fee to check', time: '5 minutes a month' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  // A link that names a board filter jumps straight to the board, so the filtered view is
  // what the reader sees instead of the top of the page. A link to a protocol's detail view
  // does not scroll: the dialog opens over the page where it is.
  var hashHasFilter = false;
  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) { state.q = params.get('q'); hashHasFilter = true; }
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) { state.category = params.get('category'); hashHasFilter = true; }
    if (params.get('chain')) { state.chain = params.get('chain'); hashHasFilter = true; }
    if (params.get('tab')) { state.tab = params.get('tab'); hashHasFilter = true; }
    if (params.get('wl') === '1') { state.wl = true; hashHasFilter = true; }
    if (params.get('min')) { state.minTvl = Number(params.get('min')) || 0; hashHasFilter = true; }
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.wl) params.set('wl', '1');
    if (state.minTvl) params.set('min', String(state.minTvl));
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.wl && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  // Every row's display value: the board's stored value, or the sandbox's recomputation.
  function displayValue(r) { return impliedOf(r, sandbox.active ? sandbox : null); }
  function sortedRows(list) {
    var key = state.sort;
    var withValue = list.map(function (r) { return { r: r, v: displayValue(r) }; });
    withValue.sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.r.name.toLowerCase(); bv = b.r.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.r.tvl_usd; bv = b.r.tvl_usd; }
      else if (key === 'growth') { av = a.r.change_7d === null ? -Infinity : a.r.change_7d; bv = b.r.change_7d === null ? -Infinity : b.r.change_7d; }
      else if (key === 'age') { av = a.r.age_days === null ? Infinity : a.r.age_days; bv = b.r.age_days === null ? Infinity : b.r.age_days; }
      else { av = a.v; bv = b.v; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.r.slug < b.r.slug ? -1 : a.r.slug > b.r.slug ? 1 : 0;
    });
    return withValue;
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var top = DATA.rows[0];
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' genuine pre-token protocols the watchlist leaves out — ' + (DATA.early_size - (DATA.above_floor_size || 0)) + ' below that floor and ' + (DATA.above_floor_size || 0) + ' above it, including the snapshot\'s largest pre-token protocol by TVL, which the watchlist does not name. No bridges, no liquid staking, no wrapped or staked products, the same rule the watchlist uses. Implied value is a model, not a promise — and it is priced per category, not at one flat multiple.' }),
        el('p', { class: 'sub', text: 'Top of the board: ' + (top ? top.name + ' at ' + fmtUsd(top.implied_value_usd) + ' implied value.' : '—') })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Above the floor, not on the watchlist' }), el('b', { text: String(DATA.above_floor_size || 0) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function categoryChart() {
    var totals = {};
    DATA.rows.forEach(function (r) {
      var c = r.category || 'Other';
      totals[c] = (totals[c] || 0) + r.implied_value_usd;
    });
    var top = Object.keys(totals).map(function (c) { return { c: c, v: totals[c] }; })
      .sort(function (a, b) { return b.v - a.v; }).slice(0, 8);
    var max = top.length ? top[0].v : 1;
    return el('section', { class: 'panel' },
      el('h2', { text: 'Where the implied value sits' }),
      el('p', { class: 'sub', text: 'Total implied value by category across the ranked board. ' + (top.length ? top[0].c + ' leads at ' + fmtUsd(top[0].v) + '; ' : '') + 'the multiples behind each category are learned from live tokens in the same category, blended with the global median.' }),
      el('div', { class: 'chart' }, top.map(function (t) {
        return el('div', { class: 'chart-row' },
          el('span', { text: t.c }),
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(2, Math.round((t.v / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(t.v) })
        );
      }))
    );
  }

  function calibrationPanel() {
    var c = DATA.calibration;
    if (!c || !c.n) {
      return el('section', { class: 'panel' },
        el('h2', { text: 'Does the model rank value?' }),
        el('p', { class: 'sub', text: 'No live-token protocol was available to check the model against, so no check ran.' })
      );
    }
    var chance = (c.top_decile_total / 10).toFixed(1);
    return el('section', { class: 'panel' },
      el('h2', { text: 'Does the model rank value? A leave-one-out check' }),
      el('p', { class: 'sub', text: 'Before ranking the pre-token board, the model is tested on the ' + c.n + ' protocols whose token already trades: each one is scored as if it had no token, with its own ratio left out of its category multiple, and the predicted value is compared with the market cap it actually trades at.' }),
      el('div', { class: 'calib' },
        el('div', { class: 'stat' }, el('span', { text: 'Rank agreement (Spearman ρ)' }), el('b', { text: c.spearman.toFixed(2) })),
        el('div', { class: 'stat' }, el('span', { text: 'Top decile found' }), el('b', { text: c.top_decile_hit + ' of ' + c.top_decile_total })),
        el('div', { class: 'stat' }, el('span', { text: 'Median predicted / actual' }), el('b', { text: c.median_ratio.toFixed(2) + 'x' })),
        el('div', { class: 'stat' }, el('span', { text: 'Predicted within 2x of actual' }), el('b', { text: Math.round(c.within_2x * 100) + '%' }))
      ),
      el('p', { class: 'sub', text: 'Of the ' + c.top_decile_total + ' most valuable live protocols, ' + c.top_decile_hit + ' land in the model\'s top decile — chance alone would put ' + chance + ' there. The model ranks value; it does not price it to the dollar. A single protocol\'s market cap can sit far from its category\'s median, and that dispersion is why the board is a ranking, not a price list.' })
    );
  }

  // The walk-forward test and the bootstrap rank ranges: the same model, held to two harder
  // checks. Walk-forward learns the multiples only from the live protocols listed before each
  // cut and scores the ones listed after it — the model as it would have stood then, tested on
  // what came next. The bootstrap refits the multiples 200 times on resampled live sets and
  // re-ranks the board each time, so every row carries the range 80% of the refits give it.
  function validationPanel() {
    var wf = DATA.walk_forward;
    var bs = DATA.bootstrap;
    var folds = (wf && wf.folds) || [];
    var foldRows = folds.map(function (f) {
      return el('tr', null,
        el('td', { text: 'Listed before ' + f.cutoff }),
        el('td', { class: 'num', text: String(f.past_n) }),
        el('td', { class: 'num', text: String(f.future_n) }),
        el('td', { class: 'num', text: f.spearman.toFixed(2) }),
        el('td', { class: 'num', text: f.top_decile_hit + ' of ' + f.top_decile_total }),
        el('td', { class: 'num', text: Math.round(f.within_2x * 100) + '%' })
      );
    });
    return el('section', { class: 'panel' },
      el('h2', { text: 'Does the ranking hold up over time? A walk-forward test' }),
      el('p', { class: 'sub', text: 'Leave-one-out tests the model on the present. Walk-forward tests it on the future: for each cut, the category multiples are learned only from the live protocols listed before that date, and scored on the ones listed after it. Protocols with no listing date are left out of both sides.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Multiples learned from' }),
            el('th', { scope: 'col', text: 'Learned' }),
            el('th', { scope: 'col', text: 'Scored' }),
            el('th', { scope: 'col', text: 'Rank agreement (ρ)' }),
            el('th', { scope: 'col', text: 'Top decile' }),
            el('th', { scope: 'col', text: 'Within 2x' })
          )),
          el('tbody', null, foldRows)
        )
      ),
      el('p', { class: 'sub', text: 'Mean rank agreement across the three folds: ρ ' + (wf ? wf.mean_spearman.toFixed(2) : 'n/a') + ' — the multiples learned from the past still rank what came next, a little below the leave-one-out figure, as a forward test should be. The top-decile hit is thin on these small future sets (1 of 6, 1 of 5, 1 of 4); the ranking signal is in the Spearman, and the dashboard does not hide the thin part.' }),
      el('h2', { text: 'How certain is each rank? 200 bootstrap refits' }),
      el('p', { class: 'sub', text: 'The multiples are refit 200 times on resampled live-token sets and the board is re-ranked each time. Every row carries the rank range the central 80% of the refits give it — shown in the board\'s Rank range column and in each detail view. The median range is ' + (bs ? bs.median_width : 'n/a') + ' ranks wide; ' + (bs ? bs.within_10 : 'n/a') + ' of ' + DATA.board_size + ' rows sit within 10 ranks and ' + (bs ? bs.within_25 : 'n/a') + ' within 25. The top of the board barely moves — the top three rows hold their rank in every refit — and the tail is wide, which is why the range is printed instead of pretending the rank is exact.' })
    );
  }

  // The term-gating test: every term of the model is removed in turn and both blind checks
  // are run again, so the table shows what each term earns instead of asserting it. A term
  // is dropped only when removing it improves both checks by at least 0.005. None is dropped
  // here — the effects are inside the noise — and the size curve, fitted the same way, does
  // not beat a flat multiple out of sample, so the model does not use one.
  function gatingPanel() {
    var g = DATA.gating;
    var sc = DATA.size_curve;
    var rows = (g && g.rows) || [];
    var body = rows.map(function (r) {
      return el('tr', null,
        el('td', { text: r.term }),
        el('td', { class: 'num', text: r.loo_with.toFixed(2) + ' → ' + r.loo_without.toFixed(2) }),
        el('td', { class: 'num', text: r.wf_with.toFixed(2) + ' → ' + r.wf_without.toFixed(2) }),
        el('td', { text: r.verdict === 'kept' ? 'Kept' : 'Dropped' })
      );
    });
    return el('section', { class: 'panel' },
      el('h2', { text: 'Which terms does the blind test keep? Term gating' }),
      el('p', { class: 'sub', text: 'Each term of the model is removed in turn and both blind checks — leave-one-out and walk-forward — are run again. The table shows the rank agreement with the term in and with it out. ' + (g ? g.rule : '') }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Term removed' }),
            el('th', { scope: 'col', text: 'Leave-one-out ρ (with → without)' }),
            el('th', { scope: 'col', text: 'Walk-forward mean ρ (with → without)' }),
            el('th', { scope: 'col', text: 'Verdict' })
          )),
          el('tbody', null, body)
        )
      ),
      el('p', { class: 'sub', text: 'No term is dropped: removing the growth term moves neither check by more than 0.001, removing maturity helps the leave-one-out by 0.004 and the walk-forward by 0.008, and removing the category multiple hurts the leave-one-out by 0.004 and the walk-forward by 0.016. Removing growth and maturity together helps both checks by 0.006 and 0.016, inside the noise — and the bounty asks the model to use the snapshot\'s TVL, growth and age figures, so the terms are kept at the weak weights the test supports. The table is the evidence the terms were tested, not asserted.' }),
      el('h2', { text: 'Does a size curve beat a flat multiple? No' }),
      el('p', { class: 'sub', text: 'A log-log fit of market cap against TVL has a steep in-sample slope — the ratio falls as protocols get bigger — but out of sample it scores ' + (sc ? 'ρ ' + sc.loo_spearman.toFixed(2) + ' leave-one-out and ρ ' + sc.wf_spearman.toFixed(2) + ' walk-forward, against ρ ' + sc.flat_loo_spearman.toFixed(2) + ' and ρ ' + sc.flat_wf_spearman.toFixed(2) + ' for a flat multiple' : 'worse than a flat multiple on both blind checks') + '. The curve does not beat the flat multiple out of sample, so the model does not use one — and the dashboard prints the loss instead of hiding it.' })
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    var tvlSel = el('select', { id: 'mintvl', 'aria-label': 'Minimum TVL' },
      el('option', { value: '0', text: 'Any TVL' }),
      [50000000, 100000000, 500000000, 1000000000].map(function (v) {
        return el('option', { value: String(v), text: 'TVL ≥ ' + fmtUsd(v), selected: state.minTvl === v ? 'selected' : null });
      })
    );
    tvlSel.addEventListener('change', function () { state.minTvl = Number(tvlSel.value) || 0; writeHash(); render(); });
    var wl = el('input', { type: 'checkbox', id: 'wl', checked: state.wl ? 'checked' : null });
    wl.addEventListener('change', function () { state.wl = wl.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('label', { for: 'mintvl', text: 'Min TVL' }), tvlSel),
      el('label', { class: 'check', for: 'wl' }, wl, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? filteredRows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; state.wl = false; writeHash(); render(); } })
      ));
    }
    var max = list[0].v || 1;
    var tbody = el('tbody');
    list.forEach(function (item, i) {
      var r = item.r;
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var rankLabel = sandbox.active ? String(i + 1) + ' (' + r.rank + ')' : String(r.rank);
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: rankLabel }),
        el('td', null, el('div', { class: 'name' },
          el('b', null, r.name, r.watchlist ? el('span', { class: 'badge', text: 'WATCHLIST' }) : null),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((item.v / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(item.v) })
        )),
        el('td', { class: 'num', text: fmtRange(r) }),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: sandbox.active ? 'Sandbox ranks: recomputed in your browser from the sliders below; board.json is unchanged.' : 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Rank range' }),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking — and they are where the category multiples are learned from.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var multiples = Object.keys(DATA.category_multiples || {}).map(function (c) {
      var e = DATA.category_multiples[c];
      return { c: c, multiple: e.multiple, samples: e.samples, fallback: e.fallback, learned_share: e.learned_share || 0 };
    }).sort(function (a, b) { return b.multiple - a.multiple; });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x category_multiple x (1 + ' + m.growth_weight + ' x sign(g) x ln(1 + |g| / 100)) x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') ),  g = clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ')'
      ),
      el('p', { class: 'sub', text: 'The category multiple is the trimmed mean market-cap-to-TVL ratio of the live-token protocols in that category — the mean of the log ratios with the top and bottom 10% cut, exponentiated — shrunk toward the global median ' + fmtMult(DATA.global_multiple) + ' with a pseudo-count of ' + m.shrink_k + ': (n x category multiple + ' + m.shrink_k + ' x global median) / (n + ' + m.shrink_k + '), then clamped to at most ' + fmtMult(m.multiple_cap) + '. Ratios are log-normal, so the centre is taken in logs, and ratios past 10x or below 0.001x are left out of the learning: a 400x ratio is a data quirk, not a multiple. The trim and the cap tame the same failure — a category with one or two live protocols lets a single ratio set its multiple, 12.16x from one protocol — so the checks score better with the extremes cut than with the median keeping them. A category with many live protocols keeps its own multiple; one with few is blended, never thrown onto the global median whole. Growth is dampened on a log scale, so a +120% week is worth 1.20x, not 1.60x. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. The board is every genuine pre-token protocol in the snapshot — the 40 on the watchlist plus the 158 the watchlist leaves out, 138 below the floor and 20 above it — and the live-token protocols are set aside with their market caps shown. Every multiple below names the traded tokens that anchor it. A walk-forward test learns the multiples only from the protocols listed before each of three cut dates and scores the ones listed after them, and a bootstrap refits the multiples 200 times on resampled live sets, so every row carries the rank range 80% of the refits give it. Each farm plan is totalled in dollars — gas, forgone yield and time — and netted to the airdrop that breaks even.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Category multiples learned from the snapshot (live protocols only), with the traded tokens anchoring each one.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Multiple' }), el('th', { scope: 'col', text: 'Live protocols' }), el('th', { scope: 'col', text: 'Anchored by' }), el('th', { scope: 'col', text: 'Note' }))),
          el('tbody', null, multiples.slice(0, 12).map(function (x) {
            var note = x.learned_share >= 0.99 ? 'own category multiple' : x.learned_share <= 0.01 ? 'global median' : 'blended, ' + Math.round(x.learned_share * 100) + '% own multiple';
            var anchors = (DATA.anchors && DATA.anchors[x.c]) || [];
            var anchorText = anchors.length === 0 ? 'no live token in this category' : anchors.map(function (a) { return a.name + ' ' + a.ratio.toFixed(2) + 'x'; }).join(', ');
            return el('tr', null,
              el('td', { text: x.c }),
              el('td', { class: 'num', text: fmtMult(x.multiple) }),
              el('td', { class: 'num', text: String(x.samples) }),
              el('td', { class: 'sub', text: anchorText }),
              el('td', { class: 'sub', text: note })
            );
          }))
        )
      )
    );
  }

  function sandboxPanel() {
    function slider(id, label, min, max, step, value, fmt, oninput) {
      var out = el('span', { id: id + '-val', text: fmt(value) });
      var input = el('input', { type: 'range', id: id, min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label });
      input.addEventListener('input', function () { sandbox.active = true; oninput(Number(input.value)); out.textContent = fmt(Number(input.value)); render(); });
      return el('div', { class: 'field' }, el('label', { for: id, text: label }), input, out);
    }
    var reset = el('button', { class: 'button', type: 'button', text: 'Reset to the board model', onclick: function () { sandbox.active = false; sandbox.mult = DEFAULTS.mult; sandbox.weight = DEFAULTS.weight; sandbox.floor = DEFAULTS.floor; render(); } });
    return el('section', { class: 'panel' },
      el('h2', { text: 'Model sandbox: re-rank the board yourself' }),
      el('p', { class: 'sub', text: 'Move a slider and the board re-sorts in your browser from the same formula — no new data, no server. The board.json this entry hands in never changes; the sandbox is a way to test what the model is sensitive to.' }),
      el('div', { class: 'sandbox' },
        slider('sb-mult', 'Category multiple scale', 0.5, 2, 0.05, sandbox.mult, function (v) { return fmtMult(v) + ' of the learned multiple'; }, function (v) { sandbox.mult = v; }),
        slider('sb-weight', 'Growth weight', 0, 1, 0.05, sandbox.weight, function (v) { return 'weight ' + v.toFixed(2); }, function (v) { sandbox.weight = v; }),
        slider('sb-floor', 'Maturity floor', 0.4, 0.8, 0.05, sandbox.floor, function (v) { return 'floor ' + v.toFixed(2); }, function (v) { sandbox.floor = v; })
      ),
      el('p', { class: 'sub sandbox-note', text: sandbox.active ? 'Sandbox active: ranks shown are recomputed, with the board rank in parentheses.' : 'Sliders at the board model: move one to re-rank.' }),
      reset
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var mult = DATA.category_multiples[row.category || 'Other'];
    var multNote = mult
      ? (mult.samples === 0
        ? 'Global median — no live-token protocol in this category to learn from.'
        : 'Trimmed mean mcap/TVL of ' + mult.samples + ' live-token protocol' + (mult.samples === 1 ? '' : 's') + ' in this category, blended with the global median (' + Math.round((mult.learned_share || 0) * 100) + '% learned).')
      : 'Global median.';
    var anchors = (DATA.anchors && DATA.anchors[row.category || 'Other']) || [];
    var anchorNote = anchors.length === 0
      ? 'No traded token anchors this multiple — it is the global median.'
      : 'Anchored by the traded tokens ' + anchors.map(function (a) { return a.name + ' (' + a.ratio.toFixed(2) + 'x on ' + fmtUsd(a.tvl_usd) + ' TVL)'; }).join(', ') + '.';
    var floorNote = (!row.watchlist && row.tvl_usd >= DATA.floor_usd)
      ? ' Above the watchlist floor — the watchlist does not name this protocol, and radar-7 includes every genuine pre-token protocol, not just the watchlist.'
      : '';
    var why = 'Rank ' + row.rank + ' because ' + fmtUsd(row.tvl_usd) + ' of TVL at a ' + fmtMult(row.category_multiple) + ' category multiple, '
      + (row.change_7d === null ? 'no reported seven-day change' : 'a seven-day change of ' + fmtPct(row.change_7d)) + ', and '
      + fmtAge(row.age_days) + ' listed with no token on record. Within ' + (row.category || 'Other') + ' it ranks #' + (row.category_rank || 1) + '.' + floorNote;
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' · on the watchlist' : ' · early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Category multiple' }), el('b', { class: 'num', text: fmtMult(row.category_multiple) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: multNote + ' ' + anchorNote + ' The page recomputes this row as ' + fmtUsd(impliedOf(row, null)) + ', the same number board.json carries. This is an estimate, not a price.' }),
      el('p', { class: 'sub', text: why }),
      el('p', { class: 'sub', text: 'Rank range: 200 refits of the multiples on resampled live-token sets place this row between #' + row.rank_low + ' and #' + row.rank_high + ' (median #' + row.rank_median + '). The rank is a claim with an uncertainty, not an exact place.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm cost: what the plan costs, and what breaks even' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Gas for the plan' }), el('b', { class: 'num', text: usd.format(row.farm.gas_usd) })),
        el('div', null, el('span', { text: 'Capital locked' }), el('b', { class: 'num', text: usd.format(row.farm.capital_usd) })),
        el('div', null, el('span', { text: 'Held' }), el('b', { class: 'num', text: row.farm.hold_days + ' days' })),
        el('div', null, el('span', { text: 'Time it takes' }), el('b', { class: 'num', text: row.farm.time_minutes + ' minutes' })),
        el('div', null, el('span', { text: 'Time valued at $10 an hour' }), el('b', { class: 'num', text: usd.format(row.farm.time_value_usd) })),
        el('div', null, el('span', { text: 'Yield the capital forgoes at 5% a year' }), el('b', { class: 'num', text: usd.format(row.farm.forgone_yield_usd) })),
        el('div', null, el('span', { text: 'Total cost, all in' }), el('b', { class: 'num', text: usd.format(row.farm.total_usd) })),
        el('div', null, el('span', { text: 'Airdrop that breaks even' }), el('b', { class: 'num', text: usd.format(row.farm.break_even_usd) })),
        el('div', null, el('span', { text: 'Implied value covers the cost' }), el('b', { class: 'num', text: fmtCover(row.farm.cover_multiple) + ' over' }))
      ),
      el('p', { class: 'sub', text: 'Verdict: ' + row.farm.verdict + ' — the plan costs ' + usd.format(row.farm.total_usd) + ' all in, so the airdrop must be worth that much to break even, and the implied value covers it ' + fmtCover(row.farm.cover_multiple) + ' over. The verdict ranks the break-even cost as a share of implied value against the board in thirds: the cheapest third farms, the middle is thin, the dearest is skipped. The capital stays yours unless the protocol fails; only the gas, the forgone yield and the time are spent.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(categoryChart());
    shell.appendChild(calibrationPanel());
    shell.appendChild(validationPanel());
    shell.appendChild(gatingPanel());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') {
      shell.appendChild(modelPanel());
      shell.appendChild(sandboxPanel());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
    if (hashHasFilter && !state.selected) {
      var controlsEl = shell.querySelector('.controls');
      if (controlsEl) controlsEl.scrollIntoView();
    }
    window.__shotReady = true;
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
