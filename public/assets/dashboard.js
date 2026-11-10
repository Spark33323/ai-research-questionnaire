/* Results dashboard — renders /api/results */
(function () {
  'use strict';

  var dash = document.getElementById('dash');
  var stamp = document.getElementById('stamp');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(v, d) {
    if (v == null || (typeof v === 'number' && !isFinite(v))) return '—';
    return typeof v === 'number' ? v.toFixed(d == null ? 2 : d) : esc(v);
  }
  function pct(v) { return v == null ? '—' : (Math.round(v * 10) / 10) + '%'; }

  function distBar(dist) {
    var total = 0, i;
    for (i = 1; i <= 5; i++) total += dist[i] || 0;
    if (!total) return '<div class="dist"></div>';
    var out = '';
    for (i = 1; i <= 5; i++) {
      var n = dist[i] || 0;
      if (!n) continue;
      out += '<span class="d' + i + '" style="width:' + (n / total) * 100 + '%" title="' + i + ': ' + n + '"></span>';
    }
    return '<div class="dist">' + out + '</div>';
  }

  function kpi(v, k) {
    return '<div class="kpi"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>';
  }

  function bars(rows) {
    var max = 1;
    rows.forEach(function (r) { max = Math.max(max, r[1]); });
    return '<div class="bars">' + rows.map(function (r) {
      return '<div class="lab" title="' + esc(r[0]) + '">' + esc(r[0]) + '</div>' +
        '<div class="track"><div class="fill" style="width:' + (r[1] / max) * 100 + '%"></div></div>' +
        '<div class="val">' + r[1] + '</div>';
    }).join('') + '</div>';
  }

  function itemTable(items, opts) {
    var head = '<tr><th>Item</th><th class="num">n</th><th class="num">Mean</th><th class="num">SD</th>' +
      '<th class="num">% agree</th><th>Distribution (1 → 5)</th>' +
      (opts && opts.extra ? '<th class="num">' + opts.extra + '</th>' : '') + '</tr>';
    var body = items.map(function (it) {
      return '<tr>' +
        '<td class="item"><span class="code">' + esc(it.code) + '</span>Q' + it.no +
        ' <span class="muted">· ' + esc(it.construct) + '</span>' +
        '<span class="txt">' + esc(it.text) + '</span></td>' +
        '<td class="num">' + it.n + '</td>' +
        '<td class="num">' + fmt(it.mean) + '</td>' +
        '<td class="num">' + fmt(it.sd) + '</td>' +
        '<td class="num">' + (it.agreePct == null ? '—' : fmt(it.agreePct, 1) + '%') + '</td>' +
        '<td>' + distBar(it.dist) + '</td>' +
        (opts && opts.extra
          ? '<td class="num">' + (opts.extra === 'Not observed' ? it.notObserved : it.noSource) + '</td>'
          : '') +
        '</tr>';
    }).join('');
    return '<div class="table-scroll"><table class="grid">' + head + body + '</table></div>';
  }

  function render(s) {
    var now = new Date(s.generatedAt);

    if (stamp) {
      stamp.textContent = 'Updated ' + now.toLocaleString() + ' · ' + s.total +
        ' response' + (s.total === 1 ? '' : 's') + ' · anonymised, no identifiers stored';
    }

    if (!s.total) {
      dash.innerHTML = '<div class="panel"><div class="empty">' +
        '<strong>No responses yet.</strong><br>Share the questionnaire link; responses appear here automatically.' +
        '</div></div>' + notesPanel();
      return;
    }

    var out = '';

    /* KPIs */
    var partC = s.itemC.reduce(function (a, it) { return a + (it.n || 0); }, 0);
    out += '<div class="kpis">' +
      kpi(s.total, 'Total responses') +
      kpi(s.last7, 'Last 7 days') +
      kpi(s.today, 'Today') +
      kpi(fmt(s.days.mean, 1), 'Mean days used (Q15)') +
      kpi(fmt(s.days.median, 1), 'Median days used (Q15)') +
      '</div>';

    /* timeline */
    if (s.daily && s.daily.length) {
      var maxD = 1;
      s.daily.forEach(function (d) { maxD = Math.max(maxD, d.count); });
      out += '<section class="panel"><h2>Responses over the last 14 days <span class="hint">one bar per day · UTC</span></h2>' +
        '<div class="spark">' + s.daily.map(function (d) {
          return '<div style="height:' + Math.max(3, (d.count / maxD) * 100) + '%" title="' +
            esc(d.date) + ': ' + d.count + '"></div>';
        }).join('') + '</div>' +
        '<div class="spark-legend"><span>' + esc(s.daily[0].date) + '</span><span>' + esc(s.daily[s.daily.length - 1].date) + '</span></div>' +
        '</section>';
    }

    /* Part A */
    out += '<section class="panel"><h2>Part A · Background and screening</h2>';
    out += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:22px">';

    out += '<div><h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3);margin:0 0 10px">Q1 · International curriculum in China</h3>' +
      bars(s.q1.map(function (r) { return [r[0], r[1]]; })) + '</div>';

    var tools = s.tools.slice(0, 10);
    out += '<div><h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3);margin:0 0 10px">Q3 · Tool named most often</h3>' +
      bars(tools.map(function (r) { return [r.tool, r.count]; })) + '</div>';
    out += '</div>';

    var grades = s.q2.slice(0, 12);
    out += '<h3 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3);margin:22px 0 10px">Q2 · Grade level</h3>' +
      bars(grades.map(function (r) { return [r[0], r[1]]; })) +
      '</section>';

    /* Part B */
    out += '<section class="panel"><h2>Part B · Perceptions and intentions (1–5 agreement)' +
      '<span class="hint">Q4–Q12 · every item refers to the tool named in Q3</span></h2>' +
      itemTable(s.itemB) +
      '<div class="note"><strong>Read these separately.</strong> Q7–Q8 are <em>trust</em> items and Q9–Q10 are <em>concern</em> items (higher = higher perceived misinformation risk). ' +
      'The direction of Q9–Q10 is opposite to Q7–Q8, so do not average them together or pool them into a single score without evidence from a pilot test.</div>' +
      '</section>';

    /* Part C */
    out += '<section class="panel"><h2>Part C · Verification behaviour, past 30 days (1–5 frequency)' +
      '<span class="hint">blank / “Not observed” is not zero</span></h2>' +
      '<div class="table-scroll"><table class="grid">' +
      '<tr><th>Item</th><th class="num">Observed n</th><th class="num">Mean</th><th class="num">SD</th>' +
      '<th class="num">% often</th><th>Distribution (1 → 5)</th><th class="num">Not observed</th>' +
      (s.itemC[1] ? '<th class="num">No source named</th>' : '') + '</tr>' +
      s.itemC.map(function (it, idx) {
        return '<tr>' +
          '<td class="item"><span class="code">' + esc(it.code) + '</span>Q' + it.no +
          ' <span class="muted">· ' + esc(it.construct) + '</span>' +
          '<span class="txt">' + esc(it.text) + '</span></td>' +
          '<td class="num">' + it.n + '</td>' +
          '<td class="num">' + fmt(it.mean) + '</td>' +
          '<td class="num">' + fmt(it.sd) + '</td>' +
          '<td class="num">' + (it.n ? (Math.round(((it.dist[4] + it.dist[5]) / it.n) * 1000) / 10) + '%' : '—') + '</td>' +
          '<td>' + distBar(it.dist) + '</td>' +
          '<td class="num">' + it.notObserved + '</td>' +
          (s.itemC[1] ? '<td class="num">' + (idx === 1 ? it.noSource : '—') + '</td>' : '') +
          '</tr>';
      }).join('') + '</table></div>' +
      '<div class="note"><strong>Coding.</strong> “Not observed” (no use in the past 30 days, or nothing to check) and “No source was named” (Q14) are stored as distinct states, not as 0 or as “Never”. ' +
      'Observed n on this panel is therefore smaller than the total response count.</div>' +
      '</section>';

    /* Part D */
    out += '<section class="panel"><h2>Part D · Actual usage (Q15)' +
      '<span class="hint">self-reported count, 0–30 days</span></h2>' +
      '<div class="kpis" style="margin-bottom:16px">' +
      kpi(s.days.n, 'Answered') +
      kpi(fmt(s.days.mean, 1), 'Mean days') +
      kpi(fmt(s.days.median, 1), 'Median days') +
      kpi(s.days.zero, 'Reported 0 days') +
      kpi(fmt(s.days.min, 0) + '–' + fmt(s.days.max, 0), 'Range') +
      '</div>' +
      bars(s.days.buckets.map(function (b) { return [b.label + ' days', b.count]; })) +
      '<div class="note"><strong>This is a count, not a scale.</strong> Do not report an internal-consistency coefficient for Q15. Where feasible, corroborate it with consented usage logs or a short use diary.</div>' +
      '</section>';

    /* Raw */
    out += '<section class="panel"><h2>Recent responses <span class="hint">latest 50 · anonymous (no IP, no identifiers)</span></h2>' +
      '<div class="table-scroll raw"><table class="grid">' +
      '<tr><th class="num">#</th><th>Submitted (UTC)</th><th>Tool</th><th>Q1</th><th>Grade</th>' +
      '<th class="num">Q4–Q12</th><th class="num">Q13</th><th class="num">Q14</th><th class="num">Q15</th></tr>' +
      s.rows.map(function (r) {
        return '<tr>' +
          '<td class="num">' + r.id + '</td>' +
          '<td>' + esc(String(r.at).replace('T', ' ').slice(0, 16)) + '</td>' +
          '<td>' + esc(r.tool) + '</td>' +
          '<td>' + esc(r.q1 === 'yes' ? 'Yes' : r.q1 === 'no' ? 'No' : '—') + '</td>' +
          '<td>' + esc(r.grade) + '</td>' +
          '<td class="num">' + (r.b || []).map(function (x) { return x == null ? '·' : x; }).join(' ') + '</td>' +
          '<td class="num">' + (r.q13 == null ? '–' : r.q13) + '</td>' +
          '<td class="num">' + (r.q14 == null ? '–' : esc(r.q14)) + '</td>' +
          '<td class="num">' + (r.q15 == null ? '–' : r.q15) + '</td>' +
          '</tr>';
      }).join('') + '</table></div>' +
      '<p style="margin:12px 0 0;font-size:12.5px;color:var(--ink-3)">The full record is available in the CSV export (one row per response).</p>' +
      '</section>';

    out += notesPanel();

    dash.innerHTML = out;

    var csv = document.getElementById('csvLink');
    var json = document.getElementById('jsonLink');
    var t = new URLSearchParams(location.search).get('token');
    if (t) {
      if (csv) csv.href = '/api/export.csv?token=' + encodeURIComponent(t);
      if (json) json.href = '/api/results?token=' + encodeURIComponent(t);
    } else {
      if (csv) csv.href = '/api/export.csv';
      if (json) json.href = '/api/results';
    }
  }

  function notesPanel() {
    return '<section class="panel"><h2>Measurement notes for the write-up</h2>' +
      '<div class="note"><ul>' +
      '<li>Every item refers to the single tool named in Q3 (“this tool”).</li>' +
      '<li>Q9–Q10 are concern items: a higher score means higher perceived misinformation risk. Keep them separate from the trust items (Q7–Q8) instead of combining them without testing.</li>' +
      '<li>In Q13–Q14, “No source was named” is distinct from “Never”; no-use and no-factual-content cases are coded as not observed, not as zero.</li>' +
      '<li>Q15 is a self-reported behavioural count, not a scale; no internal-consistency coefficient should be reported for it.</li>' +
      '<li>Two-item pairs (Q7–Q8, Q9–Q10, Q11–Q12, Q13–Q14) are candidate indicators. Examine dimensionality in the pilot and do not average them into scales without evidence.</li>' +
      '<li>This is an adapted short form that requires pilot validation; it does not inherit the source scales’ reliability coefficients or established validity.</li>' +
      '</ul></div></section>';
  }

  function fail(msg) {
    dash.innerHTML = '<div class="panel"><div class="empty">' + esc(msg) + '</div></div>';
  }

  function load() {
    var url = '/api/results';
    var t = new URLSearchParams(location.search).get('token');
    if (t) url += '?token=' + encodeURIComponent(t);
    fetch(url, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) {
        if (r.status === 401) throw new Error('Your access has expired. Open /results and enter the token again.');
        if (!r.ok) throw new Error('Could not load results (' + r.status + ').');
        return r.json();
      })
      .then(render)
      .catch(function (e) { fail(e.message); });
  }

  var btn = document.getElementById('refreshBtn');
  if (btn) btn.addEventListener('click', function () { btn.disabled = true; load(); setTimeout(function () { btn.disabled = false; }, 700); });

  load();
  setInterval(load, 30000);
})();
