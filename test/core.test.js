'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../survey-core');

const baseAnswers = {
  q1: 'yes',
  q2: 'Grade 12',
  q3: 'ChatGPT',
  q4: '5',
  q5: '4',
  q6: '3',
  q7: '2',
  q8: '1',
  q9: '3',
  q10: '4',
  q11: '5',
  q12: '4',
  q13: '2',
  q14: 'nosource',
  q15: '0',
};

test('zero usage forces verification to not observed', () => {
  const parsed = core.validate(baseAnswers);
  assert.deepEqual(parsed.errors, {});
  assert.equal(parsed.data.q13, null);
  assert.equal(parsed.data.q14, null);
  assert.equal(parsed.data.q14_no_source, 0);
});

test('required Likert items and usage day range are validated', () => {
  const parsed = core.validate({ ...baseAnswers, q4: '', q15: '31' });
  assert.match(parsed.errors.q4, /1 to 5/);
  assert.match(parsed.errors.q15, /0 to 30/);
});

test('statistics preserve no-source as a separate Q14 state', () => {
  const stats = core.computeStats([
    {
      id: 1,
      created_at: '2026-11-10T03:00:00.000Z',
      q1_international: 'yes',
      q2_grade: 'Grade 12',
      q3_tool: 'ChatGPT',
      q4_peu: 4,
      q5_pu: 5,
      q6_att: 4,
      q7_tr: 4,
      q8_tr: 4,
      q9_mr: 3,
      q10_mr: 3,
      q11_bi: 5,
      q12_bi: 5,
      q13_vb: null,
      q14_vb: null,
      q14_no_source: 1,
      q15_days: 30,
    },
  ], new Date('2026-11-10T04:00:00.000Z'));

  assert.equal(stats.total, 1);
  assert.equal(stats.itemB[0].mean, 4);
  assert.equal(stats.itemC[1].noSource, 1);
});

test('CSV neutralizes spreadsheet formulas', () => {
  const csv = core.toCSV([
    { id: 1, created_at: 'x', q3_tool: '=2+2', q14_no_source: 1 },
  ]);
  assert.match(csv, /'=2\+2/);
});
