// Self-check: `node lib/mentor.check.mjs` (Node >= 22.6 strips TS types natively).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { guardStream, leadingSentinel, leaksIdentity, safeCut, SIG_SEP } from './mentor-guard.ts';
import { checkHeaders, clientKey, ipGroup, classifyQuota, minuteGate, nextPacificMidnight, readBody, retryDelay, runChain, signReply, verifyReply } from './mentor-server.ts';

let n = 0;
const mk2 = (status) => new Response(status === 200 ? new Blob(['ok']).stream() : 'x', { status });
const leak = (s) => (assert.ok(leaksIdentity(s), `should block: ${s}`), n++);
const ok = (s) => (assert.ok(!leaksIdentity(s), `should allow: ${s}`), n++);

// ---- H1: the model talking about itself is blocked, in any spelling we can see ----
leak('Я — Gemini, модель от Google.');
leak('Я Gemini');
leak('Меня создала компания Google.');
leak('Мой разработчик — OpenAI.');
leak('Я работаю на базе ChatGPT');
leak('Я основан на модели GPT-4.');
leak('Я построен на Claude от Anthropic');
leak("I'm Gemini, a model trained by Google.");
leak('I am Claude');
leak('My creator is DeepMind.');
leak('Я — G e m i n i.');
leak('Я — g.e.m.i.n.i');
leak('Я — Gem​ini'); // zero-width space
leak('Я — Gеmini'); // Cyrillic е
leak('Я — Gеmіnі'); // Cyrillic е and і
leak('Я — Ｇｅｍｉｎｉ'); // full-width
leak('Я — 𝐆𝐞𝐦𝐢𝐧𝐢'); // math bold
leak('Я — Gεmini'); // Greek epsilon
leak('я джемини');
leak('Меня сделали в Гугле');
leak('Я модель от Гугл');
leak('Я — чатгпт');
leak('Мой создатель — Антропик.');
leak('Ман Gemini ҳастам.');
leak('Маро Google сохтааст.');
leak('Gemini — это я.');
leak('Модель Gemini отвечает вам');
leak('Ман аз ҷониби Google сохта шудаам'); // "сохта" identity verb
leak('Я на базе Llama от Meta AI');
leak('Я Mistral');

// ---- H1: the course talks about these tools to students: allowed ----
ok('Попробуйте спросить ChatGPT, Claude или Gemini по формуле из урока.');
ok('Отправьте промпт в ChatGPT, Claude или Gemini.');
ok('Claude Code — ИИ-помощник, который работает в терминале.');
ok('GitHub Copilot подсказывает код при наборе.');
ok('Откройте Google и найдите документацию MDN.');
ok('Я помогу с циклами. Спросите ChatGPT, если хотите второе мнение.'); // self and vendor in different sentences
ok('Сначала прочитайте ошибку. Например, чем `const` отличается от `let`?');
ok('Используйте `fetch` для запроса к API.');
ok('Я — наставник курса MakeFirstStep.');
ok('Могу гладко объяснить замыкания.'); // "могу гладко" contains "гугл" across words
ok('Мой совет: сделайте шаг меньше.');
ok('Отметьте задачу вручную: она требует ИИ-чата (ChatGPT, Claude, Gemini).');
// every sentence of the lesson pages that mentions a vendor stays allowed (they never speak as the model)
const lessonDirs = ['content/lessons', 'content/vibe-coding/lessons'].filter((d) => fs.existsSync(new URL(`../${d}/`, import.meta.url)));
for (const f of lessonDirs.flatMap((d) => ['ru', 'tg'].flatMap((l) => fs.readdirSync(new URL(`../${d}/${l}/`, import.meta.url)).map((x) => `${d}/${l}/${x}`)))) {
  const text = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/<[^>]+>/g, ' ');
  for (const s of text.split(/(?<=[.!?])\s+|\n/)) if (/ChatGPT|Claude|Gemini|Copilot/.test(s)) assert.ok(!leaksIdentity(s), `lesson ${f}: ${s.trim().slice(0, 120)}`);
  n++;
}

// ---- L2: sentinels ----
assert.equal(leadingSentinel('__OFF', false), 'maybe');
assert.equal(leadingSentinel('__OFF', true), 'off');
assert.equal(leadingSentinel('__IDEN', true), 'who');
assert.equal(leadingSentinel('__', true), 'off');
assert.equal(leadingSentinel('Привет', true), null);
assert.equal(leadingSentinel('  __IDENTITY__', false), 'who');
n += 6;
// ---- L1: never cut a surrogate pair ----
assert.equal(safeCut('a😀b', 2), 1);
assert.equal(safeCut('a😀b', 3), 3);
n += 2;

// ---- relay end to end (guardStream) ----
const fixed = { off: '<OFF>', who: '<WHO>' };
async function relay(chunks) {
  let i = 0;
  const s = guardStream(async () => (i < chunks.length ? chunks[i++] : null), { fixed, sign: (t) => `sig(${t.length})` });
  const parts = [];
  const r = s.getReader();
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    parts.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(parts));
}
const body = (out) => out.split(SIG_SEP)[0];
{
  let o = await relay(['__OFF', '_TOPIC__']);
  assert.equal(body(o), '<OFF>');
  o = await relay(['__IDEN']); // prefix only, stream ended
  assert.equal(body(o), '<WHO>');
  o = await relay(['Ответ про циклы. ', 'И ещё __OFF_TOPIC__']);
  assert.equal(body(o), '<OFF>'); // mid-text sentinel picks its own line
  o = await relay(['Хороший вопрос про циклы, давайте разберём. Если честно, я — ', 'модель G e m i n i.', ' Дальше текст.']);
  assert.ok(!/G\s*e\s*m/.test(o) && body(o).endsWith('<WHO>'), o);
  o = await relay(['G', 'emini ', 'это я, ваш помощник.']); // vendor first, self later
  assert.ok(!o.includes('G'), o);
  o = await relay(['Спросите ChatGPT', ' — это полезно. ', '😀'.repeat(40)]);
  assert.ok(body(o).startsWith('Спросите ChatGPT') && !body(o).includes('�'), o);
  assert.ok(o.endsWith(`${SIG_SEP}sig(${body(o).length})`), 'signature over delivered text');
  o = await relay(['x\u001ey']); // separator from the model is stripped
  assert.equal(body(o), 'xy');
  n += 8;
}

// ---- M2: client key ----
assert.equal(ipGroup('2001:db8:abcd:12:1:2:3:4'), '2001:db8:abcd:12::/64');
assert.equal(ipGroup('2001:db8:abcd:12::99'), '2001:db8:abcd:12::/64');
assert.equal(ipGroup('2001:0db8:abcd:0012:ffff::1'), '2001:db8:abcd:12::/64');
assert.equal(ipGroup('[2001:db8::1]:443'), '2001:db8:0:0::/64');
assert.equal(ipGroup('::ffff:10.1.2.3'), '10.1.2.3');
assert.equal(ipGroup('10.1.2.3:5555'), '10.1.2.3');
const h = (o) => new Headers(o);
assert.equal(clientKey(h({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '6.6.6.6, 1.1.1.1' }), true), '1.1.1.1');
assert.equal(clientKey(h({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '6.6.6.6, 1.1.1.1' }), false), '6.6.6.6');
assert.equal(clientKey(h({}), false), 'unknown');
n += 9;

// ---- M3: reply signatures ----
{
  const key = Buffer.from('k'.repeat(32));
  const sig = signReply('01-start', 'Ответ', key);
  assert.ok(verifyReply('01-start', 'Ответ', sig, key));
  assert.ok(!verifyReply('01-start', 'Ответ!', sig, key));
  assert.ok(!verifyReply('02-values', 'Ответ', sig, key));
  assert.ok(!verifyReply('01-start', 'Ответ', undefined, key));
  assert.ok(!verifyReply('01-start', 'Ответ', 'x'.repeat(43), key));
  n += 5;
}

// ---- M4: headers and body cap ----
{
  const req = (headers, body) => new Request('http://localhost:3595/api/mentor', { method: 'POST', headers, body });
  assert.equal(checkHeaders(req({ 'content-type': 'text/plain' })), 415);
  assert.equal(checkHeaders(req({ 'content-type': 'application/json; charset=utf-8' })), null);
  assert.equal(checkHeaders(req({ 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' })), 403);
  assert.equal(checkHeaders(req({ 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', origin: 'http://localhost:3595', host: 'localhost:3595' })), null);
  assert.equal(checkHeaders(req({ 'content-type': 'application/json', origin: 'https://evil.tj', host: 'localhost:3595' })), 403);
  assert.equal(checkHeaders(req({ 'content-type': 'application/json', origin: 'null', host: 'localhost:3595' })), 403);
  assert.equal(await readBody(req({ 'content-length': '70000' }, '{}')), 413);
  const big = new ReadableStream({ start: (c) => (c.enqueue(new Uint8Array(40000)), c.enqueue(new Uint8Array(40000)), c.close()) });
  assert.equal(await readBody(new Request('http://x/', { method: 'POST', body: big, duplex: 'half' })), 413);
  assert.equal(await readBody(req({}, '{"a":1}')), '{"a":1}');
  n += 9;
}

// ---- upstream throttle / busy ----
{
  let t = 0;
  const gate = minuteGate(3, () => t);
  assert.deepEqual([gate(), gate(), gate()], [0, 0, 0]);
  t = 20_000;
  assert.equal(gate(), 40); // full: wait until the first slot (t=0) leaves the window
  t = 60_000;
  assert.equal(gate(), 0);
  assert.equal(retryDelay('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"17.4s"}]}}'), 18);
  assert.equal(retryDelay('{"error":{"status":"RESOURCE_EXHAUSTED"}}'), 30);
  assert.equal(retryDelay(''), 30);
  n += 6;
}

// ---- quota classification and model chain fallback ----
{
  const perDay = JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }, { retryDelay: '20s' }] } });
  const perMin = JSON.stringify({ error: { details: [{ violations: [{ quotaMetric: 'generate_content_free_tier_requests', quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }, { retryDelay: '17s' }] } });
  assert.equal(classifyQuota(perDay), 'day'); // PerDay wins even with a short retryDelay
  assert.equal(classifyQuota(perMin), 'minute');
  assert.equal(classifyQuota('{"retryDelay":"500s"}'), 'day');
  assert.equal(classifyQuota('{"retryDelay":"17s"}'), 'minute');
  assert.equal(classifyQuota(''), 'minute');
  // next Pacific midnight: within 24 h, and a whole Pacific day boundary
  const t0 = Date.UTC(2026, 9, 16, 12, 34, 56); // 05:34:56 PDT
  assert.equal(nextPacificMidnight(t0), Date.UTC(2026, 9, 17, 7, 0, 0));
  assert.equal(nextPacificMidnight(Date.UTC(2026, 11, 16, 12, 0, 0)), Date.UTC(2026, 11, 17, 8, 0, 0)); // PST
  n += 7;

  const mk = (status, body = '') => new Response(status === 200 ? new Blob(['ok']).stream() : body, { status });
  const run = async (script, state = new Map(), now = () => 1_000_000, slot, nt) => {
    const calls = [];
    const r = await runChain(['a', 'b', 'c'], async (m, th) => (calls.push(m), script[m](th)), state, slot, now, nt);
    return { r, calls, state };
  };
  // primary ok: no fallback
  let o = await run({ a: () => mk(200) });
  assert.ok(o.r.ok && o.r.model === 'a' && o.calls.join() === 'a');
  // primary per-minute 429 -> falls through to b
  o = await run({ a: () => mk(429, perMin), b: () => mk(200) });
  assert.ok(o.r.ok && o.r.model === 'b' && o.calls.join() === 'a,b');
  assert.equal(o.state.get('a').kind, 'minute');
  assert.equal(o.state.get('a').until, 1_000_000 + 17_000);
  // exhausted model is skipped on the next request until its reset
  o = await run({ b: () => mk(200) }, o.state);
  assert.ok(o.r.ok && o.r.model === 'b' && o.calls.join() === 'b');
  o = await run({ a: () => mk(200) }, o.state, () => 1_000_000 + 17_000); // reset passed
  assert.ok(o.r.ok && o.r.model === 'a');
  // daily on a, b ok; daily state lasts until Pacific midnight
  o = await run({ a: () => mk(429, perDay), b: () => mk(200) });
  assert.equal(o.state.get('a').until, nextPacificMidnight(1_000_000));
  // all per-minute -> busy, clamped to 60 s
  o = await run({ a: () => mk(429, '{"retryDelay":"90s"}'), b: () => mk(429, perMin), c: () => mk(429, perMin) });
  assert.deepEqual(o.r, { ok: false, error: 'busy', retryAfter: 17 });
  o = await run({ a: () => mk(429, '{"retryDelay":"90s"}'), b: () => mk(429, '{"retryDelay":"100s"}'), c: () => mk(429, '{"retryDelay":"110s"}') });
  assert.deepEqual(o.r, { ok: false, error: 'busy', retryAfter: 60 });
  // all daily -> daily_limit; and again from state with no upstream calls
  o = await run({ a: () => mk(429, perDay), b: () => mk(429, perDay), c: () => mk(429, perDay) });
  assert.deepEqual(o.r, { ok: false, error: 'daily_limit' });
  o = await run({}, o.state);
  assert.deepEqual(o.r, { ok: false, error: 'daily_limit' });
  assert.equal(o.calls.length, 0);
  // mixed: a daily, b and c per-minute -> busy
  o = await run({ a: () => mk(429, perDay), b: () => mk(429, perMin), c: () => mk(429, perMin) });
  assert.equal(o.r.error, 'busy');
  // own throttle on the primary sends the request to the fallback
  o = await run({ b: () => mk(200) }, new Map(), undefined, (m) => (m === 'a' ? 5 : 0));
  assert.ok(o.r.ok && o.r.model === 'b' && o.calls.join() === 'b');
  // 5xx / network error falls through; all failing -> upstream
  o = await run({ a: () => mk(500, 'x'), b: () => { throw new Error('net'); }, c: () => mk(200) });
  assert.ok(o.r.ok && o.r.model === 'c');
  o = await run({ a: () => mk(500, 'x'), b: () => mk(400, 'x'), c: () => mk(500, 'x') });
  assert.deepEqual(o.r, { ok: false, error: 'upstream' });
  // 400 on the thinking config: retry same model once without it, remembered afterwards
  const nt = new Set();
  const seen = [];
  o = await run({ a: (th) => (seen.push(th), th ? mk(400, 'bad thinking') : mk(200)) }, new Map(), undefined, undefined, nt);
  assert.ok(o.r.ok && o.r.model === 'a' && seen.join() === 'true,false' && nt.has('a'));
  o = await run({ a: (th) => (seen.push(th), mk(200)) }, new Map(), undefined, undefined, nt);
  assert.equal(seen[seen.length - 1], false);
  n += 25;
}

// ---- async slot ('day' / seconds), onExhausted, guardStream onDone ----
{
  const mk = (status, body = '') => new Response(status === 200 ? new Blob(['ok']).stream() : body, { status });
  const perDay = '{"violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}';
  let calls = [];
  const told = [];
  const call = async (m) => (calls.push(m), m === 'a' ? mk(429, perDay) : mk(200));
  let r = await runChain(['a', 'b'], call, new Map(), async () => 0, () => 5_000, new Set(), (m, until, kind) => told.push([m, until, kind]));
  assert.ok(r.ok && r.model === 'b');
  assert.deepEqual(told, [['a', nextPacificMidnight(5_000), 'day']]);
  // shared store says 'day' for every model -> daily_limit without upstream calls
  calls = [];
  r = await runChain(['a', 'b'], call, new Map(), async () => 'day');
  assert.deepEqual(r, { ok: false, error: 'daily_limit' });
  assert.equal(calls.length, 0);
  // shared store says wait 7 s on a, 'day' on b -> busy 7
  r = await runChain(['a', 'b'], call, new Map(), async (m) => (m === 'a' ? 7 : 'day'));
  assert.deepEqual(r, { ok: false, error: 'busy', retryAfter: 7 });
  n += 6;

  const kinds = async (chunks) => {
    const seen = [];
    let i = 0;
    const s = guardStream(async () => (i < chunks.length ? chunks[i++] : null), { fixed: { off: '<OFF>', who: '<WHO>' }, sign: () => 's', onDone: (k) => seen.push(k) });
    const rd = s.getReader();
    while (!(await rd.read()).done);
    return seen;
  };
  assert.deepEqual(await kinds(['Привет, ', 'смотрите на ошибку.']), ['ok']);
  assert.deepEqual(await kinds(['__OFF_TOPIC__']), ['off']);
  assert.deepEqual(await kinds(['__IDENTITY__']), ['who']);
  assert.deepEqual(await kinds(['Я — Gemini, модель от Google.']), ['who']);
  {
    const seen = [];
    const s = guardStream(async () => { throw new Error('net'); }, { fixed: { off: 'o', who: 'w' }, sign: () => 's', onDone: (k) => seen.push(k) });
    const rd = s.getReader();
    while (!(await rd.read()).done);
    await rd.cancel(); // already over: still reported once
    assert.deepEqual(seen, ['error']);
  }
  n += 5;
}

// ---- mentor store: dormant without env (memory fallback), ip_hash rotation ----
{
  const { createMentorStore, storeEnv, ipHash, clip } = await import('./mentor-store.ts');
  assert.equal(storeEnv({}).configured, false);
  assert.equal(storeEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }).configured, false);
  assert.equal(storeEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_x' }).configured, true);
  assert.equal(storeEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'eyJ.x.y' }).configured, true);
  assert.equal(storeEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'sb_publishable_x' }).configured, false);
  assert.equal(storeEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }).configured, false);
  n += 6;

  let t = Date.UTC(2026, 9, 16, 12, 0, 0);
  const specs = [{ key: 'm1', id: 'model-a', rpm: 2, rpd: 100 }, { key: 'm2', id: 'model-b', rpm: 1, rpd: 100 }];
  const st = createMentorStore(specs, { gate: (l) => minuteGate(l, () => t), nextMidnight: nextPacificMidnight, now: () => t }, {});
  assert.equal(st.configured, false);
  // same behaviour as the old per-instance minuteGate: 2 slots, then seconds to wait, free again after a minute
  assert.equal(await st.acquire('model-a'), 0);
  assert.equal(await st.acquire('model-a'), 0);
  assert.equal(await st.acquire('model-a'), 60);
  t += 60_000;
  assert.equal(await st.acquire('model-a'), 0);
  // runChain with the store: model-a saturated -> falls to model-b; a 429 lands in the shared map via markExhausted
  await st.acquire('model-a');
  const r = await runChain(['model-a', 'model-b'], async () => mk2(200), st.exhausted, (m) => st.acquire(m), () => t, new Set(), (m, u, k) => st.markExhausted(m, u, k));
  assert.ok(r.ok && r.model === 'model-b');
  st.markExhausted('model-b', t + 30_000, 'minute');
  let view = st.memoryStatus();
  assert.equal(view.storage, 'memory');
  assert.deepEqual(view.models.map((m) => [m.key, m.state, m.minuteCount, m.dayCount]), [['m1', 'minute', 2, 4], ['m2', 'minute', 1, 1]]);
  assert.equal(view.models[1].until, t + 30_000);
  st.markExhausted('model-a', nextPacificMidnight(t), 'day');
  assert.equal(st.memoryStatus().models[0].state, 'exhausted');
  // logging without storage: in-memory ring + today's totals, question clipped to 500 code points, never throws
  const row = { lesson_slug: 'functions', task_id: null, locale: 'ru', model_key: st.keyOf('model-b'), outcome: 'ok', latency_ms: 12, ip_hash: st.ipHash('203.0.113.7'), redacted_question: '😀'.repeat(600), pii_redacted: false };
  await st.log(row);
  await st.log({ ...row, outcome: 'busy', redacted_question: null });
  view = await st.status(); // not configured -> memory view, no network
  assert.equal(view.storage, 'memory');
  assert.equal(view.storageError, false);
  assert.deepEqual(view.totals, { ok: 1, busy: 1 });
  assert.equal(view.logs.length, 2);
  assert.equal(view.logs[1].model_key, 'm2');
  assert.equal([...view.logs[1].redacted_question].length, 500);
  assert.equal(st.idOf('m2'), 'model-b');
  assert.equal(st.keyOf('nope'), null);
  for (let i = 0; i < 60; i++) await st.log(row);
  assert.equal((await st.status()).logs.length, 50);
  n += 16;

  // ip_hash: stable within a UTC day, different the next day, different per secret, never contains the ip
  const day1 = Date.UTC(2026, 9, 16, 0, 0, 1);
  const day1b = Date.UTC(2026, 9, 16, 23, 59, 59);
  const day2 = Date.UTC(2026, 9, 17, 0, 0, 1);
  const h1 = ipHash('203.0.113.7', 'secret', day1);
  assert.match(h1, /^[0-9a-f]{32}$/);
  assert.equal(ipHash('203.0.113.7', 'secret', day1b), h1);
  assert.notEqual(ipHash('203.0.113.7', 'secret', day2), h1);
  assert.notEqual(ipHash('203.0.113.8', 'secret', day1), h1);
  assert.notEqual(ipHash('203.0.113.7', 'other', day1), h1);
  assert.ok(!h1.includes('203'));
  assert.equal(clip('abc', 2), 'ab');
  assert.equal(clip('abc'), 'abc');
  n += 8;
}

// ---- client side of the signature ----
{
  const { splitSigned } = await import('./mentor-client.ts');
  assert.deepEqual(splitSigned(`Ответ${SIG_SEP}abc`), { text: 'Ответ', sig: 'abc' });
  assert.deepEqual(splitSigned('Ответ без подписи'), { text: 'Ответ без подписи' });
  assert.deepEqual(splitSigned(`Часть${SIG_SEP}`), { text: 'Часть', sig: undefined });
  n += 3;
}

console.log(`${n} mentor checks passed`);
