'use strict';

/* Pure survey rules shared by the local Node server and the serverless deployment. */

const ITEMS_B = [
  { no: 4, code: 'PEU', construct: 'Perceived ease of use', text: 'I find this tool easy to use for academic research.' },
  { no: 5, code: 'PU', construct: 'Perceived usefulness', text: 'Using this tool improves my effectiveness in academic research.' },
  { no: 6, code: 'ATT', construct: 'Attitude', text: 'I regard using this tool for academic research as a good choice.' },
  { no: 7, code: 'TR', construct: 'Trust', text: 'This tool has the competence to provide the academic information I need.' },
  { no: 8, code: 'TR', construct: 'Trust', text: 'I regard this tool as a credible source of academic guidance.' },
  { no: 9, code: 'MR', construct: 'Misinformation risk (concern)', text: 'I am concerned that this tool may give me incorrect or outdated academic information.' },
  { no: 10, code: 'MR', construct: 'Misinformation risk (concern)', text: 'I am concerned that this tool may give academic answers that sound convincing but are factually wrong.' },
  { no: 11, code: 'BI', construct: 'Behavioural intention', text: 'I intend to use this tool for academic research during the next 30 days.' },
  { no: 12, code: 'BI', construct: 'Behavioural intention', text: 'I plan to use this tool for academic research during the next 30 days.' },
];

const ITEMS_C = [
  { no: 13, code: 'VB', construct: 'Verification behaviour', text: 'Compare this tool’s factual answers with textbooks or course materials?' },
  { no: 14, code: 'VB', construct: 'Verification behaviour', text: 'When this tool named a source, check whether that source existed?' },
];

const COL = {
  4: 'q4_peu',
  5: 'q5_pu',
  6: 'q6_att',
  7: 'q7_tr',
  8: 'q8_tr',
  9: 'q9_mr',
  10: 'q10_mr',
  11: 'q11_bi',
  12: 'q12_bi',
  13: 'q13_vb',
  14: 'q14_vb',
};

function stat(item, rows, colOf) {
  const vals = [];
  for (const row of rows) {
    const value = row[colOf];
    if (Number.isInteger(value) && value >= 1 && value <= 5) vals.push(value);
  }
  const n = vals.length;
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  vals.forEach((value) => dist[value]++);
  const sum = vals.reduce((a, b) => a + b, 0);
  const mean = n ? sum / n : null;
  const sd = n > 1
    ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
    : null;
  return {
    ...item,
    n,
    mean,
    sd,
    dist,
    agreePct: n ? ((dist[4] + dist[5]) / n) * 100 : null,
  };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normTool(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function computeStats(rows, now = new Date()) {
  const total = rows.length;
  const dayKey = (date) => date.toISOString().slice(0, 10);
  const today = dayKey(now);
  const since7 = new Date(now.getTime() - 6 * 864e5);
  const since30 = new Date(now.getTime() - 29 * 864e5);
  const last7Start = new Date(dayKey(since7) + 'T00:00:00Z');
  const last30Start = new Date(dayKey(since30) + 'T00:00:00Z');
  const last7 = rows.filter((row) => new Date(row.created_at) >= last7Start).length;
  const last30 = rows.filter((row) => new Date(row.created_at) >= last30Start).length;

  const countBy = (fn) => {
    const counts = new Map();
    for (const row of rows) {
      const key = fn(row);
      if (key == null || key === '') continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))
    );
  };

  const toolsMap = new Map();
  for (const row of rows) {
    const display = normTool(row.q3_tool);
    if (!display) continue;
    const key = display.toLowerCase();
    const current = toolsMap.get(key);
    if (current) current.count++;
    else toolsMap.set(key, { count: 1, spellings: new Map([[display, 1]]) });
  }
  const tools = [...toolsMap.values()]
    .map((value) => {
      const best = [...value.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { tool: best, count: value.count };
    })
    .sort((a, b) => b.count - a.count || a.tool.localeCompare(b.tool));

  const itemB = ITEMS_B.map((item) => stat(item, rows, COL[item.no]));
  const itemC = ITEMS_C.map((item) => {
    const noSource = item.no === 14
      ? rows.filter((row) => row.q14_no_source === 1).length
      : 0;
    return {
      ...stat(item, rows, COL[item.no]),
      notObserved: rows.filter(
        (row) => row[COL[item.no]] == null && !(item.no === 14 && row.q14_no_source === 1)
      ).length,
      noSource: item.no === 14 ? noSource : undefined,
    };
  });

  const days = rows
    .map((row) => row.q15_days)
    .filter((value) => Number.isInteger(value));
  const daysSum = days.reduce((a, b) => a + b, 0);
  const buckets = [
    ['0', (value) => value === 0],
    ['1–5', (value) => value >= 1 && value <= 5],
    ['6–10', (value) => value >= 6 && value <= 10],
    ['11–15', (value) => value >= 11 && value <= 15],
    ['16–20', (value) => value >= 16 && value <= 20],
    ['21–25', (value) => value >= 21 && value <= 25],
    ['26–30', (value) => value >= 26 && value <= 30],
  ].map(([label, fn]) => ({ label, count: days.filter(fn).length }));

  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 864e5);
    const key = dayKey(date);
    daily.push({
      date: key,
      count: rows.filter((row) => String(row.created_at).slice(0, 10) === key).length,
    });
  }

  return {
    generatedAt: now.toISOString(),
    total,
    last7,
    last30,
    today: rows.filter((row) => String(row.created_at).slice(0, 10) === today).length,
    q1: countBy((row) => row.q1_international === 'yes'
      ? 'Yes'
      : row.q1_international === 'no'
        ? 'No'
        : null),
    q2: countBy((row) => row.q2_grade),
    tools,
    itemB,
    itemC,
    days: {
      n: days.length,
      mean: days.length ? daysSum / days.length : null,
      median: median(days),
      min: days.length ? Math.min(...days) : null,
      max: days.length ? Math.max(...days) : null,
      zero: days.filter((value) => value === 0).length,
      buckets,
    },
    daily,
    rows: rows
      .slice(-50)
      .reverse()
      .map((row) => ({
        id: row.id,
        at: row.created_at,
        tool: row.q3_tool,
        grade: row.q2_grade,
        q1: row.q1_international,
        b: [
          row.q4_peu,
          row.q5_pu,
          row.q6_att,
          row.q7_tr,
          row.q8_tr,
          row.q9_mr,
          row.q10_mr,
          row.q11_bi,
          row.q12_bi,
        ],
        q13: row.q13_vb,
        q14: row.q14_no_source ? 'No source' : row.q14_vb,
        q15: row.q15_days,
      })),
  };
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Spreadsheet formula-injection guard for free-text fields.
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\n\r]/.test(text)
    ? '"' + text.replace(/"/g, '""') + '"'
    : text;
}

function toCSV(rows) {
  const head = [
    'response_id',
    'submitted_at_utc',
    'q1_international_curriculum',
    'q2_grade',
    'q3_tool',
    'q4_peu',
    'q5_pu',
    'q6_att',
    'q7_tr',
    'q8_tr',
    'q9_mr',
    'q10_mr',
    'q11_bi',
    'q12_bi',
    'q13_vb',
    'q14_vb',
    'q14_no_source_named',
    'q15_days_used',
  ];
  const lines = [head.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.created_at,
        row.q1_international,
        row.q2_grade,
        row.q3_tool,
        row.q4_peu,
        row.q5_pu,
        row.q6_att,
        row.q7_tr,
        row.q8_tr,
        row.q9_mr,
        row.q10_mr,
        row.q11_bi,
        row.q12_bi,
        row.q13_vb,
        row.q14_no_source ? '' : row.q14_vb,
        row.q14_no_source,
        row.q15_days,
      ].map(csvCell).join(',')
    );
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function clean(value, max = 120) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function validate(raw) {
  const errors = {};
  const out = {};

  out.q1 = raw.q1 === 'yes' ? 'yes' : raw.q1 === 'no' ? 'no' : null;
  if (!out.q1) errors.q1 = 'Please choose Yes or No.';

  out.q2 = clean(raw.q2, 80);
  if (!out.q2) errors.q2 = 'Please choose your grade level (or “Not currently a student”).';

  out.q3 = clean(raw.q3, 80);
  if (!out.q3) errors.q3 = 'Please name the AI tool you use most often.';

  for (const item of ITEMS_B) {
    const value = Number(raw['q' + item.no]);
    if (Number.isInteger(value) && value >= 1 && value <= 5) out['q' + item.no] = value;
    else errors['q' + item.no] = 'Please choose one number from 1 to 5.';
  }

  const q13 = String(raw.q13 == null ? '' : raw.q13);
  out.q13 = /^[1-5]$/.test(q13) ? Number(q13) : null;

  const q14 = String(raw.q14 == null ? '' : raw.q14);
  if (/^[1-5]$/.test(q14)) {
    out.q14 = Number(q14);
    out.q14_no_source = 0;
  } else if (q14 === 'nosource') {
    out.q14 = null;
    out.q14_no_source = 1;
  } else {
    out.q14 = null;
    out.q14_no_source = 0;
  }

  const rawDays = String(raw.q15 == null ? '' : raw.q15).trim();
  const days = /^\d{1,2}$/.test(rawDays) ? Number(rawDays) : NaN;
  if (Number.isInteger(days) && days >= 0 && days <= 30) {
    out.q15 = days;
  } else {
    out.q15 = null;
    errors.q15 = 'Please enter a whole number of days from 0 to 30.';
  }

  if (out.q15 === 0) {
    out.q13 = null;
    out.q14 = null;
    out.q14_no_source = 0;
  }

  return { data: out, errors };
}

module.exports = {
  ITEMS_B,
  ITEMS_C,
  COL,
  computeStats,
  toCSV,
  validate,
};
