// Token Radar dashboard — no network, no framework. Reads window.RADAR
// (written by main.ts from the sealed snapshot) and renders the board, the
// live-token view, the model explainer and one protocol's detail view.
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D || !Array.isArray(D.rows)) {
    document.body.innerHTML = '<p style="padding:24px">Radar data missing: run main.ts to write data.js beside this page.</p>';
    return;
  }
  var WL = {};
  D.watchlist.forEach(function (s) { WL[s] = true; });

  // ------------------------------------------------------------ formatting
  function money(v) {
    if (v === null || v === undefined) return '—';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(v);
  }
  function moneyFull(v) {
    if (v === null || v === undefined) return '—';
    return '$' + Math.round(v).toLocaleString('en-US');
  }
  function pct(v) {
    if (v === null || v === undefined) return '<span class="flat">—</span>';
    var c = v > 0 ? 'up' : v < 0 ? 'dn' : 'flat';
    var s = (v > 0 ? '+' : '') + v.toFixed(1) + '%';
    return '<span class="' + c + '">' + s + '</span>';
  }
  function age(v) {
    if (v === null || v === undefined) return '—';
    if (v >= 365) return (v / 365).toFixed(1) + 'y';
    return v + 'd';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------ header stats
  var topTvl = D.rows.reduce(function (a, r) { return a + r.tvl_usd; }, 0);
  $('meta').innerHTML =
    '<div class="stat"><b>' + D.board_size + '</b><span>protocols ranked</span></div>' +
    '<div class="stat"><b>' + D.watchlist_size + '</b><span>on watchlist</span></div>' +
    '<div class="stat"><b>' + money(topTvl) + '</b><span>board TVL</span></div>' +
    '<div class="stat"><b>' + esc(D.as_of) + '</b><span>snapshot date</span></div>';
  $('asof').textContent = D.as_of;

  // ------------------------------------------------------------ tabs
  var tabs = document.querySelectorAll('#tabs button');
  tabs.forEach(function (b) {
    b.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('on'); });
      $('tab-' + b.dataset.tab).classList.add('on');
      if (b.dataset.tab === 'radar') renderBoard();
    });
  });

  // ------------------------------------------------------------ filter controls
  var chains = {}, cats = {};
  D.rows.forEach(function (r) {
    r.chains.forEach(function (c) { chains[c] = true; });
    if (r.category) cats[r.category] = true;
  });
  Object.keys(chains).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; $('chain').appendChild(o);
  });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; $('cat').appendChild(o);
  });

  var state = { q: '', chain: '', cat: '', wl: false, sort: 'rank', dir: 1, sel: null };
  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (state.wl && !WL[r.slug]) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (q && (r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0)) return false;
      return true;
    });
    var k = state.sort, d = state.dir;
    rows.sort(function (a, b) {
      var x = a[k], y = b[k];
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      if (typeof x === 'string') return d * (x < y ? -1 : x > y ? 1 : 0);
      return d * (x - y);
    });
    return rows;
  }

  function renderBoard() {
    var rows = filtered();
    $('count').textContent = rows.length + ' of ' + D.rows.length + ' shown';
    var html = rows.map(function (r) {
      var ratio = (r.implied_value_usd / Math.max(r.tvl_usd, 1)).toFixed(2);
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.sel === r.slug ? ' class="sel"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="nm">' + esc(r.name) + '</span> <span class="sl">' + esc(r.slug) + '</span>' +
        (WL[r.slug] ? ' <span class="pill wl">watchlist</span>' : '') + '</td>' +
        '<td>' + (r.category ? esc(r.category) : '<span class="flat">—</span>') + '</td>' +
        '<td>' + r.chains.slice(0, 3).map(esc).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td>' +
        '<td class="num">' + ratio + 'x</td></tr>';
    }).join('');
    $('rows').innerHTML = html || '<tr><td colspan="9" style="text-align:center;color:var(--muted)">No protocols match these filters.</td></tr>';
    document.querySelectorAll('#board th').forEach(function (th) {
      th.classList.toggle('on', th.dataset.k === state.sort);
    });
  }

  document.querySelectorAll('#board th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.dataset.k;
      if (state.sort === k) state.dir = -state.dir;
      else { state.sort = k; state.dir = (k === 'rank' || k === 'name' || k === 'category' || k === 'chains') ? 1 : -1; }
      renderBoard();
    });
  });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) showDetail(tr.dataset.slug);
  });
  $('q').addEventListener('input', function () { state.q = this.value; renderBoard(); });
  $('chain').addEventListener('change', function () { state.chain = this.value; renderBoard(); });
  $('cat').addEventListener('change', function () { state.cat = this.value; renderBoard(); });
  $('wl').addEventListener('change', function () { state.wl = this.checked; renderBoard(); });

  // ------------------------------------------------------------ detail view
  function factorRow(label, value, max) {
    var w = Math.max(2, Math.min(100, (value / max) * 100));
    return '<div class="factor"><span>' + label + '</span><span class="fv">' + value.toFixed(2) + 'x</span>' +
      '<span class="bar"><i style="width:' + w.toFixed(0) + '%"></i></span></div>';
  }
  function showDetail(slug) {
    var r = null;
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === slug) { r = D.rows[i]; break; }
    if (!r) return;
    state.sel = slug;
    renderBoard();
    var base = r.tvl_usd * D.model.base_multiple;
    var m = D.model;
    var why = 'Rank #' + r.rank + ' of ' + D.rows.length + ': ' + money(r.tvl_usd) + ' TVL' +
      (r.change_7d !== null ? ' growing ' + (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '% in 7 days' : '') +
      (r.age_days !== null ? ', live ' + age(r.age_days) : '') +
      ' on ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') +
      (r.category ? ' as a ' + r.category + ' protocol' : '') + '.';
    var steps = r.farm_steps.map(function (s) {
      var cut = s.indexOf(' Cost: ');
      var main = cut > 0 ? s.slice(0, cut) : s;
      var rest = cut > 0 ? s.slice(cut + 1) : '';
      return '<li><b>' + esc(main) + '</b>' + (rest ? '<br><span style="color:var(--muted)">' + esc(rest) + '</span>' : '') + '</li>';
    }).join('');
    $('detail-body').innerHTML =
      '<h2>' + esc(r.name) + '</h2><div class="slug">' + esc(r.slug) +
      (WL[r.slug] ? ' · <span class="pill wl">watchlist</span>' : ' · early find') + '</div>' +
      '<div class="kv">' +
      '<div><b>' + money(r.implied_value_usd) + '</b><span>implied value</span></div>' +
      '<div><b>' + money(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div><b>' + (r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</b><span>TVL change, 7d</span></div>' +
      '<div><b>' + age(r.age_days) + '</b><span>age' + (r.listed_at ? ' · since ' + esc(r.listed_at) : '') + '</span></div>' +
      '<div><b>' + esc(r.chains.join(', ')) + '</b><span>chains</span></div>' +
      '<div><b>' + (r.category ? esc(r.category) : '—') + '</b><span>category</span></div>' +
      '</div>' +
      '<p style="color:var(--muted);font-size:13px">' + esc(why) + '</p>' +
      '<h3>How the value is built</h3>' +
      '<div class="formula">implied = ' + moneyFull(base) + ' base × growth × maturity × chains × category</div>' +
      factorRow('Growth ×' + m.growth_weight, r.growth_multiplier, 1.9) +
      factorRow('Maturity', r.maturity_multiplier, 1) +
      factorRow('Chains ×' + m.chain_step, r.chains_multiplier, 1.15) +
      factorRow('Category', r.category_multiplier, 1.15) +
      '<h3>Farm plan — 6 steps</h3><ol class="steps">' + steps + '</ol>' +
      '<p style="color:var(--dim);font-size:12px">This protocol records no token in the snapshot. That is not proof it has none — and never pay anyone to claim a drop.</p>';
    $('detail').hidden = false;
  }
  $('detail-close').addEventListener('click', function () {
    $('detail').hidden = true; state.sel = null; renderBoard();
  });

  // ------------------------------------------------------------ live tokens
  $('live-rows').innerHTML = D.live.map(function (r) {
    var ratio = r.mcap_usd ? (r.mcap_usd / Math.max(r.tvl_usd, 1)).toFixed(2) + 'x' : '—';
    return '<tr><td><span class="nm">' + esc(r.name) + '</span> <span class="sl">' +
      (r.symbol ? esc(r.symbol) : esc(r.slug)) + '</span></td>' +
      '<td>' + (r.category ? esc(r.category) : '<span class="flat">—</span>') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num"><b>' + money(r.mcap_usd) + '</b></td>' +
      '<td class="num">' + ratio + '</td>' +
      '<td class="num">' + pct(r.change_7d) + '</td></tr>';
  }).join('');

  // ------------------------------------------------------------ model explainer
  var m = D.model;
  var catRows = Object.keys(D.category_mult).sort().map(function (c) {
    return '<tr><td>' + esc(c) + '</td><td class="num">' + D.category_mult[c].toFixed(2) + 'x</td></tr>';
  }).join('');
  $('model-doc').innerHTML =
    '<h2>How the model works — radar-2</h2>' +
    '<p>Every protocol on the board is scored by the same five factors, all taken from the sealed snapshot. No name is ever special-cased: change the snapshot and the board changes with it. The formula is printed on every detail view, factor by factor.</p>' +
    '<div class="formula">implied = TVL × ' + m.base_multiple + ' × growth × maturity × chains × category</div>' +
    '<h3>The five factors</h3><ul>' +
    '<li><b>Base</b> — TVL × ' + m.base_multiple + '. A token&rsquo;s fully diluted value has historically run near a third of a healthy protocol&rsquo;s TVL at launch.</li>' +
    '<li><b>Growth</b> — 7-day TVL change clamped to ' + m.growth_floor + '%…+' + m.growth_cap + '%, weighted ×' + m.growth_weight + ', floored at ×' + m.growth_min_mult + '. One hot week cannot crown a protocol; one cold week cannot zero it.</li>' +
    '<li><b>Maturity</b> — ' + m.maturity_floor + ' + min(age, ' + m.maturity_days + ' days) / ' + m.maturity_days + ' × ' + m.maturity_range + '. Age runs from the listing date to the snapshot date; unknown age counts as ' + m.unknown_age_days + ' days.</li>' +
    '<li><b>Chains</b> — 1 + ' + m.chain_step + ' per extra chain, up to +' + (m.chain_step * m.chain_max_extra * 100).toFixed(0) + '%. More chains mean more users and fees — but a chain list cannot carry a ranking.</li>' +
    '<li><b>Category</b> — one multiplier per category (table below). Fee-earning categories price above 1; pass-through ones such as bridges price below 1; unlisted categories are 1.00.</li></ul>' +
    '<h3>Category multipliers</h3><table><thead><tr><th>Category</th><th class="num">Multiplier</th></tr></thead><tbody>' + catRows + '</tbody></table>' +
    '<h3>What the board covers</h3><ul>' +
    '<li><b>' + D.watchlist_size + ' watchlist protocols</b> — TVL at or above ' + money(D.floor_usd) + ', recording no token, and not a wrapped, staked or bridged product. The floor, never the ceiling.</li>' +
    '<li><b>' + (D.board_size - D.watchlist_size) + ' early finds</b> — every other pre-token protocol the snapshot can rank, below the floor. This is the radar&rsquo;s job: find launches early.</li>' +
    '<li><b>' + D.live_size + ' live tokens</b> — shown on their own tab at the market&rsquo;s value, never ranked against the pre-token board.</li>' +
    '<li><b>Left out on purpose</b> — wrapped, staked and bridged products (WBTC, staked ETH, bridges) and exchanges: they are a token that already trades in another form, not a launch still to come.</li></ul>' +
    '<h3>What this radar does not do</h3><p>It does not predict whether or when a protocol issues a token. “Records no token” is a statement about the snapshot&rsquo;s record, not about the world: a protocol on this board may still have a token its record does not carry. Farm plans are a starting point — verify every step on the protocol&rsquo;s own official pages before spending anything.</p>';

  // ------------------------------------------------------------ init
  renderBoard();
})();
