CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  q1_international TEXT,
  q2_grade TEXT,
  q3_tool TEXT,
  q4_peu INTEGER,
  q5_pu INTEGER,
  q6_att INTEGER,
  q7_tr INTEGER,
  q8_tr INTEGER,
  q9_mr INTEGER,
  q10_mr INTEGER,
  q11_bi INTEGER,
  q12_bi INTEGER,
  q13_vb INTEGER,
  q14_vb INTEGER,
  q14_no_source INTEGER NOT NULL DEFAULT 0,
  q15_days INTEGER
);

CREATE INDEX IF NOT EXISTS idx_responses_created ON responses(created_at);
