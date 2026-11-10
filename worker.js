'use strict';

/* Always-on Cloudflare Worker version. Persistent answers live in D1. */

import core from './survey-core.js';
import views from './views.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' };

function response(status, body, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
        "script-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      ...headers,
    },
  });
}

function html(status, body, headers = {}) {
  return response(status, body, { ...HTML_HEADERS, ...headers });
}

function json(status, value, headers = {}) {
  return response(status, JSON.stringify(value), { ...JSON_HEADERS, ...headers });
}

function redirect(location, headers = {}) {
  return response(303, '', { Location: location, ...headers });
}

function cookies(request) {
  const out = {};
  const raw = request.headers.get('Cookie');
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

async function digest(value) {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')))
  );
}

async function safeEqual(left, right) {
  if (!left || !right) return false;
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function isAdmin(request, url, env) {
  if (!env.ADMIN_TOKEN) return false;
  const token = url.searchParams.get('token');
  if (token) return safeEqual(token, env.ADMIN_TOKEN);
  return safeEqual(cookies(request).q_admin, env.ADMIN_TOKEN);
}

function setCookie(name, value, maxAge, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly${secure}`;
}

async function bestEffortRateLimit(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ipHash = [...await digest(ip + ':' + env.ADMIN_TOKEN)]
      .slice(0, 8)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const cache = caches.default;
    const key = new Request(`https://rate-limit.invalid/${ipHash}`);
    const cached = await cache.match(key);
    const count = cached ? Number(await cached.text()) : 0;
    if (count >= 100) return true;
    await cache.put(
      key,
      new Response(String(count + 1), { headers: { 'Cache-Control': 'max-age=60' } })
    );
  } catch {
    // Rate limiting is best-effort; collection should continue if cache is unavailable.
  }
  return false;
}

async function save(env, data) {
  const row = await env.DB.prepare(`
    INSERT INTO responses
      (created_at, q1_international, q2_grade, q3_tool,
       q4_peu, q5_pu, q6_att, q7_tr, q8_tr, q9_mr, q10_mr, q11_bi, q12_bi,
       q13_vb, q14_vb, q14_no_source, q15_days)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    RETURNING id
  `).bind(
    new Date().toISOString(),
    data.q1,
    data.q2,
    data.q3,
    data.q4,
    data.q5,
    data.q6,
    data.q7,
    data.q8,
    data.q9,
    data.q10,
    data.q11,
    data.q12,
    data.q13,
    data.q14,
    data.q14_no_source,
    data.q15
  ).first();
  return row.id;
}

async function rowsFromDb(env) {
  const result = await env.DB.prepare('SELECT * FROM responses ORDER BY id').all();
  return result.results || [];
}

function installCheck(env) {
  if (!env.DB) {
    return json(503, { ok: false, error: 'D1 database binding DB is missing.' });
  }
  if (!env.ADMIN_TOKEN) {
    return json(503, { ok: false, error: 'ADMIN_TOKEN secret is missing.' });
  }
  return null;
}

async function handle(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;
  const configurationError = installCheck(env);
  if (configurationError) return configurationError;

  if (pathname === '/' && method === 'GET') {
    return html(200, views.pageQuestionnaire({}, {}, {
      alreadySubmitted: cookies(request).q_submitted === '1' && url.searchParams.get('again') !== '1',
    }), { 'Cache-Control': 'no-store' });
  }

  if (pathname === '/api/submit' && method === 'POST') {
    if (await bestEffortRateLimit(request, env)) {
      return json(429, { ok: false, error: 'too many submissions' });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { ok: false, error: 'body must be JSON' });
    }
    const { data, errors } = core.validate(body || {});
    if (Object.keys(errors).length) return json(422, { ok: false, errors });
    return json(201, { ok: true, id: await save(env, data) });
  }

  if (pathname === '/submit' && method === 'POST') {
    if (await bestEffortRateLimit(request, env)) {
      return html(
        429,
        views.pageError(429, 'Too many submissions from this connection. Please wait a minute.'),
        { 'Cache-Control': 'no-store' }
      );
    }
    const raw = Object.fromEntries(new URLSearchParams(await request.text()));
    const { data, errors } = core.validate(raw);
    if (Object.keys(errors).length) {
      return html(422, views.pageQuestionnaire(raw, errors, {}), { 'Cache-Control': 'no-store' });
    }
    await save(env, data);
    return redirect('/thanks', {
      'Set-Cookie': setCookie('q_submitted', '1', 2592000, request),
    });
  }

  if (pathname === '/thanks' && method === 'GET') {
    return html(200, views.pageThanks(), { 'Cache-Control': 'no-store' });
  }

  if (pathname === '/admin/login' && method === 'POST') {
    const raw = Object.fromEntries(new URLSearchParams(await request.text()));
    const token = String(raw.token || '').trim();
    if (await safeEqual(token, env.ADMIN_TOKEN)) {
      return redirect('/results', {
        'Set-Cookie': setCookie('q_admin', env.ADMIN_TOKEN, 604800, request),
      });
    }
    return html(401, views.pageAuth({ error: 'That token is not correct.' }), {
      'Cache-Control': 'no-store',
    });
  }

  if (pathname === '/results' && method === 'GET') {
    const token = url.searchParams.get('token');
    if (token && await safeEqual(token, env.ADMIN_TOKEN)) {
      return redirect('/results', {
        'Set-Cookie': setCookie('q_admin', env.ADMIN_TOKEN, 604800, request),
      });
    }
    if (!await isAdmin(request, url, env)) {
      return html(401, views.pageAuth({}), { 'Cache-Control': 'no-store' });
    }
    return html(200, views.pageResultsShell(), { 'Cache-Control': 'no-store' });
  }

  if (pathname === '/api/results' && method === 'GET') {
    if (!await isAdmin(request, url, env)) {
      return json(401, { ok: false, error: 'unauthorised' });
    }
    return json(200, core.computeStats(await rowsFromDb(env)), {
      'Cache-Control': 'no-store',
    });
  }

  if (pathname === '/api/export.csv' && method === 'GET') {
    if (!await isAdmin(request, url, env)) {
      return response(401, 'unauthorised', {
        'Content-Type': 'text/plain; charset=utf-8',
      });
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return response(200, core.toCSV(await rowsFromDb(env)), {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ai-tool-academic-research-responses-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    });
  }

  if (pathname === '/health') {
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM responses').first();
    return json(200, {
      ok: true,
      responses: count.count,
      deployment: 'cloudflare-worker',
    }, { 'Cache-Control': 'no-store' });
  }

  return html(404, views.pageError(404, 'Page not found.'), { 'Cache-Control': 'no-store' });
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (error) {
      console.error('[error]', request.method, new URL(request.url).pathname, error && error.message);
      return html(500, views.pageError(500, 'Something went wrong. Please try again.'), {
        'Cache-Control': 'no-store',
      });
    }
  },
};
