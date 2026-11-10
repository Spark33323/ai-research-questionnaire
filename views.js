'use strict';

/* HTML templates for the AI-tool academic-research questionnaire. */

const ESC = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LIKERT5 = [
  [1, 'Strongly disagree'],
  [2, 'Disagree'],
  [3, 'Neutral'],
  [4, 'Agree'],
  [5, 'Strongly agree'],
];

const FREQ5 = [
  [1, 'Never'],
  [2, 'Rarely'],
  [3, 'Sometimes'],
  [4, 'Often'],
  [5, 'Very often'],
];

/* ---------- shared shell ---------- */
function shell({ title, body, bodyClass = '', extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ESC(title)}</title>
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="/assets/style.css">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#4338ca"/><text x="32" y="45" font-size="34" font-family="Georgia,serif" fill="#fff" text-anchor="middle">Q</text></svg>'
  )}">
${extraHead}
</head>
<body class="${bodyClass}">
${body}
</body>
</html>`;
}

/* ---------- questionnaire ---------- */
function radio5(name, items, value, disabled, label) {
  return `<div class="likert" role="radiogroup" aria-required="true" aria-label="${ESC(label || name)}">
    ${items
      .map(([v, label]) => {
        const id = `${name}_${v}`;
        const checked = String(value) === String(v) ? ' checked' : '';
        return `<label class="opt${checked ? ' is-checked' : ''}" for="${id}"${disabled ? ' aria-disabled="true"' : ''}>
          <input type="radio" id="${id}" name="${name}" value="${v}"${checked}${disabled ? ' disabled' : ''}>
          <span class="num">${v}</span><span class="lab">${ESC(label)}</span>
        </label>`;
      })
      .join('')}
  </div>`;
}

function radioNA(name, items, value, naSelected, label) {
  return `<div class="likert" role="radiogroup" aria-label="${ESC(label || name)}">
    ${items
      .map(([v, label]) => {
        const id = `${name}_${v}`;
        const checked = String(value) === String(v) ? ' checked' : '';
        return `<label class="opt${checked ? ' is-checked' : ''}" for="${id}">
          <input type="radio" id="${id}" name="${name}" value="${v}"${checked}>
          <span class="num">${v}</span><span class="lab">${ESC(label)}</span>
        </label>`;
      })
      .join('')}
    <label class="opt opt-na${naSelected ? ' is-checked' : ''}" for="${name}_na">
      <input type="radio" id="${name}_na" name="${name}" value="na"${naSelected ? ' checked' : ''}>
      <span class="num">—</span><span class="lab">Not observed <span class="muted">(did not use the tool / nothing to check)</span></span>
    </label>
  </div>`;
}

function err(name, errors) {
  return errors && errors[name] ? `<p class="field-error" role="alert">${ESC(errors[name])}</p>` : '';
}

function questionBlock({ no, code, text, note, control, name, errors, extraClass = '', optional = false }) {
  const hasError = !!(errors && name && errors[name]);
  let ctl = control;
  if (hasError) {
    ctl = ctl.replace('<div class="', `<div aria-describedby="err-${no}" aria-invalid="true" class="`);
  }
  return `<div class="q${extraClass}" id="question-${no}">
    <div class="q-head">
      <span class="q-no" aria-hidden="true">${no}</span>
      <h3 class="q-text" id="qtext-${no}"><span class="sr-only">Question ${no}. </span>${text}${optional ? '' : ' <span class="req" aria-hidden="true">*</span>'}${code ? ` <span class="code">[${ESC(code)}]</span>` : ''}</h3>
    </div>
    ${note ? `<p class="q-note">${note}</p>` : ''}
    ${ctl}
    ${hasError ? `<p class="field-error" id="err-${no}" role="alert">${ESC(errors[name])}</p>` : ''}
  </div>`;
}

const GRADES = [
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
  'Year 10',
  'Year 11',
  'Year 12',
  'Year 13',
  'University undergraduate',
  'Postgraduate / Master’s / PhD',
  'Teacher, lecturer or researcher',
  'Not currently a student',
  'Other',
];

function pageQuestionnaire(v = {}, errors = {}, opts = {}) {
  const V = (k) => (v[k] == null ? '' : v[k]);
  const already = opts.alreadySubmitted
    ? `<div class="banner">
        <strong>You already submitted a response from this browser.</strong>
        Thank you! If you need to submit another response (for example, on behalf of another respondent), you can keep going — otherwise you can close this page.
      </div>`
    : '';

  const body = `
<header class="site-head">
  <div class="wrap">
    <p class="eyebrow">Academic research questionnaire · anonymous</p>
    <h1>AI Tool Use for Academic Research</h1>
    <p class="lede">This questionnaire asks how you use <em>one</em> AI tool for schoolwork and academic work, what you think about it, and how you check what it tells you.</p>
    <p class="meta">About 5 minutes · 15 questions · Questions marked <span class="req">*</span> are required</p>
  </div>
</header>

<main class="wrap">
  <div class="progress" id="progress" aria-hidden="true"><div class="bar" id="progressBar"></div></div>
  ${already}

  <section class="card intro">
    <h2>Before you start</h2>
    <p>This questionnaire is <strong>anonymous and voluntary</strong>. Your answers will be used for academic research only, and they cannot be linked to your identity. You may skip the survey or stop at any point.</p>

    <div class="define">
      <h3>How “this tool” is defined</h3>
      <p>In <strong>Question 3</strong> you name the <strong>one AI tool you most often use</strong> for schoolwork or academic work. Every statement after that refers to <strong>that same tool</strong> — not to AI tools in general, and not to a mix of tools.</p>
    </div>

    <h3>Answer scales</h3>
    <ul class="scales">
      <li><strong>Agreement (Questions 4–12):</strong> 1 = Strongly disagree · 2 = Disagree · 3 = Neutral · 4 = Agree · 5 = Strongly agree</li>
      <li><strong>Frequency, past 30 days (Questions 13–14):</strong> 1 = Never · 2 = Rarely · 3 = Sometimes · 4 = Often · 5 = Very often</li>
    </ul>
  </section>

  <form method="post" action="/submit" novalidate id="qform">
    <section class="card">
      <h2 class="part">Part A · Background and screening</h2>

      ${questionBlock({
        no: 1,
        text: 'Are you currently studying an international curriculum in China?',
        control: `<div class="yesno" role="radiogroup" aria-required="true" aria-label="Are you currently studying an international curriculum in China?">
          <label class="opt${String(V('q1')) === 'yes' ? ' is-checked' : ''}" for="q1_yes">
            <input type="radio" id="q1_yes" name="q1" value="yes"${String(V('q1')) === 'yes' ? ' checked' : ''}>
            <span class="num">✓</span><span class="lab">Yes</span>
          </label>
          <label class="opt${String(V('q1')) === 'no' ? ' is-checked' : ''}" for="q1_no">
            <input type="radio" id="q1_no" name="q1" value="no"${String(V('q1')) === 'no' ? ' checked' : ''}>
            <span class="num">✕</span><span class="lab">No</span>
          </label>
        </div>`,
        errors,
      })}

      ${questionBlock({
        no: 2,
        text: 'If you are a student, what grade level are you in?',
        note: 'If you are not a student, choose “Not currently a student”.',
        control: `<div class="field">
          <label class="sr-only" for="q2">Grade level</label>
          <select id="q2" name="q2">
            <option value="">Please choose…</option>
            ${GRADES.map(
              (g) => `<option value="${ESC(g)}"${V('q2') === g ? ' selected' : ''}>${ESC(g)}</option>`
            ).join('')}
          </select>
        </div>`,
        name: 'q2',
        errors,
      })}

      ${questionBlock({
        no: 3,
        text: 'What is the AI tool that you most often use for school work / academic work?',
        note: 'Write one tool only (for example ChatGPT, Claude, Gemini, DeepSeek, Kimi, Doubao, Copilot, Perplexity, Grammarly). Every later question refers to this tool.',
        control: `<div class="field">
          <label class="sr-only" for="q3">AI tool you use most often</label>
          <input type="text" id="q3" name="q3" maxlength="80" autocomplete="off" placeholder="e.g. ChatGPT" value="${ESC(V('q3'))}" list="toolSuggest">
          <datalist id="toolSuggest">
            <option value="ChatGPT"></option><option value="Claude"></option><option value="Gemini"></option>
            <option value="DeepSeek"></option><option value="Kimi"></option><option value="Doubao"></option>
            <option value="Microsoft Copilot"></option><option value="Perplexity"></option><option value="Grammarly"></option>
            <option value="Notion AI"></option><option value="Monica"></option><option value="Wenxin Yiyan / ERNIE"></option>
          </datalist>
        </div>`,
        name: 'q3',
        errors,
      })}
    </section>

    <section class="card">
      <h2 class="part">Part B · Perceptions and intentions</h2>
      <p class="part-note">All statements below refer to the tool you named in Question 3 (“this tool”). Please choose one number for each statement.</p>
      <div class="legend-box">
        <strong>1</strong> Strongly disagree &nbsp;·&nbsp; <strong>2</strong> Disagree &nbsp;·&nbsp; <strong>3</strong> Neutral &nbsp;·&nbsp; <strong>4</strong> Agree &nbsp;·&nbsp; <strong>5</strong> Strongly agree
      </div>

      ${[
        [4, 'PEU', 'I find this tool easy to use for academic research.'],
        [5, 'PU', 'Using this tool improves my effectiveness in academic research.'],
        [6, 'ATT', 'I regard using this tool for academic research as a good choice.'],
        [7, 'TR', 'This tool has the competence to provide the academic information I need.'],
        [8, 'TR', 'I regard this tool as a credible source of academic guidance.'],
        [9, 'MR', 'I am concerned that this tool may give me incorrect or outdated academic information.'],
        [10, 'MR', 'I am concerned that this tool may give academic answers that sound convincing but are factually wrong.'],
      ]
        .map(([no, code, text]) =>
          questionBlock({
            no,
            code,
            text: ESC(text),
            control: radio5(`q${no}`, LIKERT5, V(`q${no}`), false, text),
            name: `q${no}`,
            errors,
          })
        )
        .join('')}

      <p class="part-note note-30">For Questions 11 and 12, consider the <strong>next 30 days</strong>.</p>
      ${[[11, 'BI', 'I intend to use this tool for academic research during the next 30 days.'],
        [12, 'BI', 'I plan to use this tool for academic research during the next 30 days.']]
        .map(([no, code, text]) =>
          questionBlock({
            no,
            code,
            text: ESC(text),
            control: radio5(`q${no}`, LIKERT5, V(`q${no}`), false, text),
            name: `q${no}`,
            errors,
          })
        )
        .join('')}
    </section>

    <section class="card">
      <h2 class="part">Part C · Verification behaviour (past 30 days)</h2>
      <p class="part-note">During the past 30 days, when using this tool for academic research, how often did you do the following?</p>
      <div class="legend-box">
        <strong>1</strong> Never &nbsp;·&nbsp; <strong>2</strong> Rarely &nbsp;·&nbsp; <strong>3</strong> Sometimes &nbsp;·&nbsp; <strong>4</strong> Often &nbsp;·&nbsp; <strong>5</strong> Very often
      </div>
      <p class="part-note small">These two questions are optional. If you did not use the tool in the past 30 days, or had no factual information to check, choose “Not observed” — it is recorded as <em>not observed</em>, not as zero.</p>

      ${questionBlock({
        no: 13,
        code: 'VB',
        optional: true,
        text: 'Compare this tool’s factual answers with textbooks or course materials?',
        control: radioNA('q13', FREQ5, V('q13'), V('q13') === 'na', 'Compare this tool’s factual answers with textbooks or course materials?'),
        name: 'q13',
        errors,
      })}

      ${questionBlock({
        no: 14,
        code: 'VB',
        optional: true,
        text: 'When this tool named a source, check whether that source existed?',
        control: `<div class="likert" role="radiogroup" aria-label="When this tool named a source, check whether that source existed?">
            ${FREQ5.map(([v, label]) => {
              const checked = String(V('q14')) === String(v) ? ' checked' : '';
              return `<label class="opt${checked ? ' is-checked' : ''}" for="q14_${v}">
                <input type="radio" id="q14_${v}" name="q14" value="${v}"${checked}>
                <span class="num">${v}</span><span class="lab">${ESC(label)}</span>
              </label>`;
            }).join('')}
            <label class="opt opt-na${V('q14') === 'nosource' ? ' is-checked' : ''}" for="q14_nosource">
              <input type="radio" id="q14_nosource" name="q14" value="nosource"${V('q14') === 'nosource' ? ' checked' : ''}>
              <span class="num">∅</span><span class="lab">No source was named <span class="muted">(choose this rather than “Never” when the tool did not name any source)</span></span>
            </label>
            <label class="opt opt-na${V('q14') === 'na' ? ' is-checked' : ''}" for="q14_na">
              <input type="radio" id="q14_na" name="q14" value="na"${V('q14') === 'na' ? ' checked' : ''}>
              <span class="num">—</span><span class="lab">Not observed <span class="muted">(did not use the tool / nothing to check)</span></span>
            </label>
          </div>`,
        name: 'q14',
        errors,
      })}
    </section>

    <section class="card">
      <h2 class="part">Part D · Actual usage</h2>
      ${questionBlock({
        no: 15,
        code: 'AU',
        text: 'On how many of the past 30 days did you use this tool for academic research?',
        control: `<div class="field days">
          <label class="sr-only" for="q15">Days out of the past 30</label>
          <input type="number" id="q15" name="q15" min="0" max="30" step="1" inputmode="numeric" placeholder="0–30" value="${ESC(V('q15'))}">
          <span class="days-unit">days out of 30</span>
        </div>
        <p class="q-note small">Enter a whole number from 0 to 30. If your answer is 0, Part C does not apply to you.</p>`,
        name: 'q15',
        errors,
      })}
    </section>

    ${errors && Object.keys(errors).length
      ? `<div class="card error-summary" role="alert"><strong>Please check the highlighted question${Object.keys(errors).length > 1 ? 's' : ''} before submitting.</strong></div>`
      : ''}

    <div class="submit-row">
      <button type="submit" class="btn" id="submitBtn">Submit response</button>
      <p class="fine">By submitting, you agree that your anonymous answers may be used for academic research.</p>
    </div>
  </form>

  <footer class="site-foot">
    <p>Questions 4–15 are adapted from published instruments for pilot validation. Item-level provenance is available on the researcher side.</p>
  </footer>
</main>
<script>
(function () {
  var form = document.getElementById('qform');
  var bar = document.getElementById('progressBar');
  var btn = document.getElementById('submitBtn');

  function answered() {
    var names = ['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10','q11','q12','q15'];
    var total = names.length + 2, done = 0;
    names.forEach(function (n) {
      var el = form.elements[n];
      if (!el) return;
      if (el.value && String(el.value).trim() !== '') done++;
    });
    ['q13','q14'].forEach(function (n) {
      var els = form.querySelectorAll('input[name="' + n + '"]:checked');
      if (els.length) done++;
    });
    return Math.round((done / total) * 100);
  }

  function paint() {
    if (!bar) return;
    var p = answered();
    bar.style.width = Math.max(2, p) + '%';
    bar.parentNode.setAttribute('aria-valuenow', p);
  }

  form.addEventListener('change', function (e) {
    var opt = e.target.closest ? e.target.closest('.opt') : null;
    if (opt && e.target.type === 'radio') {
      var group = form.querySelectorAll('input[name="' + e.target.name + '"]');
      group.forEach(function (g) {
        var l = g.closest('.opt');
        if (l) l.classList.toggle('is-checked', g.checked);
      });
    }
    paint();
  });
  form.addEventListener('input', paint);

  form.addEventListener('submit', function () {
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  });

  paint();
})();
</script>`;

  return shell({ title: 'AI Tool Use for Academic Research · Questionnaire', body, bodyClass: 'page-survey' });
}

function pageThanks() {
  const body = `
<main class="wrap narrow">
  <section class="card thanks">
    <div class="tick" aria-hidden="true">✓</div>
    <h1>Thank you — your response has been recorded.</h1>
    <p>Your answers were submitted anonymously and will be used for academic research only.</p>
    <p class="muted">You can close this window now.</p>
    <p class="small"><a href="/?again=1">Submit another response</a> (for example, if you are helping someone else answer).</p>
  </section>
</main>`;
  return shell({ title: 'Thank you · AI Tool Use for Academic Research', body, bodyClass: 'page-thanks' });
}

/* ---------- results dashboard ---------- */
function pageResultsShell() {
  const body = `
<header class="site-head dash-head">
  <div class="wrap wide">
    <div class="dash-top">
      <div>
        <p class="eyebrow">Researcher view · live results</p>
        <h1>AI Tool Use for Academic Research</h1>
      </div>
      <div class="dash-actions">
        <button class="btn ghost" id="refreshBtn" type="button">Refresh</button>
        <a class="btn ghost" id="csvLink" href="#" download>Download CSV</a>
        <a class="btn ghost" href="#" id="jsonLink" target="_blank" rel="noopener">JSON</a>
      </div>
    </div>
    <p class="meta"><span id="stamp">Loading…</span></p>
  </div>
</header>
<main class="wrap wide" id="dash">
  <p class="loading">Loading results…</p>
</main>
<script src="/assets/dashboard.js"></script>`;
  return shell({ title: 'Results · AI Tool Use for Academic Research', body, bodyClass: 'page-dash' });
}

function pageAuth({ error } = {}) {
  const body = `
<main class="wrap narrow">
  <section class="card auth">
    <h1>Researcher access</h1>
    <p>This page shows the collected responses. Enter the access token to continue.</p>
    ${error ? `<p class="field-error" role="alert">${ESC(error)}</p>` : ''}
    <form method="post" action="/admin/login">
      <div class="field">
        <label class="sr-only" for="token">Access token</label>
        <input type="password" id="token" name="token" placeholder="Access token" autocomplete="current-password" autofocus>
      </div>
      <button class="btn" type="submit">Open results</button>
    </form>
    <p class="small muted">The token is printed by the server at startup and stored in <code>data/admin-token.txt</code>.</p>
  </section>
</main>`;
  return shell({ title: 'Researcher access · AI Tool Use for Academic Research', body, bodyClass: 'page-auth' });
}

function pageError(status, msg) {
  const body = `
<main class="wrap narrow">
  <section class="card auth">
    <h1>${ESC(status)}</h1>
    <p>${ESC(msg)}</p>
    <p><a class="btn ghost" href="/">Back to the questionnaire</a></p>
  </section>
</main>`;
  return shell({ title: `${status} · AI Tool Use for Academic Research`, body, bodyClass: 'page-error' });
}

module.exports = { shell, pageQuestionnaire, pageThanks, pageResultsShell, pageAuth, pageError, ESC };
