import type { Messages } from '../messages/ru';
import { explain } from './explain';

export type OutLine = { text: string; cls: '' | 'err' | 'warn-line' | 'empty' };
export type RunResult = { lines: OutLine[]; hadError: boolean };

export type RunSpec =
  | { mode: 'console'; code: string }
  | { mode: 'dom'; html: string; css: string; js: string }
  | { mode: 'react'; jsx: string; css: string };

/** User-visible texts of the runner (`t.runner`) and runtime error hints (`t.explain`), in the UI language. */
export type RunStrings = { runner: Messages['runner']; explain: Messages['explain'] };

export type RunOptions = {
  strings: RunStrings;
  /** Called with a snapshot of all lines every time a new line arrives (streaming). */
  onLines?: (lines: OutLine[]) => void;
  /** dom/react: the visible preview iframe (owned by the caller). Console mode creates its own hidden one. */
  frame?: HTMLIFrameElement;
  /** dom/react: content height reported by the preview page. */
  onHeight?: (px: number) => void;
};

export type Job = { id: string; result: Promise<RunResult>; stop: () => void };


const LOOP_MS = 3000; // no heartbeat from the frame for this long = main thread is stuck
const CAP_MS = 8000; // hard cap for pending async work
const MAX_LINES = 500;

// esm.sh, pinned exact versions (keep in sync with package.json react)
const REACT_VERSION = '19.3.1';
const IMPORT_MAP = JSON.stringify({
  imports: {
    react: `https://esm.sh/react@${REACT_VERSION}`,
    'react/jsx-runtime': `https://esm.sh/react@${REACT_VERSION}/jsx-runtime`,
    'react-dom': `https://esm.sh/react-dom@${REACT_VERSION}?external=react`,
    'react-dom/client': `https://esm.sh/react-dom@${REACT_VERSION}/client?external=react,react-dom`,
  },
});

/**
 * Code that runs INSIDE the sandboxed iframe: console-style value formatter + console patch +
 * pending-work tracking (timers, intervals, rAF, fetch, response body reads) that decides when to
 * post 'done'. Kept as a plain string (never Function.prototype.toString of transpiled code).
 * NOTE: String.raw keeps backslashes; do not use backticks or dollar-brace in here.
 * `ID` and `MODE` are prepended by the runner. Wrapped in an IIFE so no globals leak into user code
 * except __ilmEnd / __ilmHold.
 */
const BOOT = String.raw`(function () {
function fmt(v, depth, seen) {
  depth = depth || 0;
  seen = seen || new Set();
  const IDENT = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;
  if (typeof v === 'string') return depth ? '"' + v + '"' : v;
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (typeof v === 'function') return 'ƒ ' + (v.name || 'anonymous') + '()';
  if (v === null || typeof v !== 'object') return String(v);
  if (v instanceof Error) return v.name + ': ' + v.message;
  if (typeof Element !== 'undefined' && v instanceof Element)
    return '<' + v.tagName.toLowerCase() + (v.id ? '#' + v.id : '') + (typeof v.className === 'string' && v.className ? '.' + v.className.trim().split(/\s+/).join('.') : '') + '>';
  if (v instanceof Promise) return 'Promise {…}';
  if (seen.has(v)) return '[Circular]';
  if (depth > 4) return Array.isArray(v) ? '[…]' : '{…}';
  seen.add(v);
  const isArr = Array.isArray(v);
  const parts = isArr
    ? Array.from(v, function (x) { return fmt(x, depth + 1, seen); })
    : Object.keys(v).map(function (k) { return (IDENT.test(k) ? k : '"' + k + '"') + ': ' + fmt(v[k], depth + 1, seen); });
  seen.delete(v);
  if (!parts.length) return isArr ? '[]' : '{}';
  const flat = isArr ? '[' + parts.join(', ') + ']' : '{ ' + parts.join(', ') + ' }';
  if (flat.length <= 72 && !flat.includes('\n')) return flat;
  const pad = '  '.repeat(depth + 1);
  return (isArr ? '[' : '{') + '\n' + parts.map(function (p) { return pad + p; }).join(',\n') + '\n' + '  '.repeat(depth) + (isArr ? ']' : '}');
}
const send = function (kind, text) { parent.postMessage({ ilmRun: ID, kind: kind, text: text }, '*'); };
for (const k of ['log', 'info', 'debug', 'warn', 'error'])
  console[k] = function () { send(k, Array.prototype.map.call(arguments, function (x) { return fmt(x); }).join(' ')); };
function cell(v) { return fmt(v, v !== null && typeof v === 'object' ? 1 : 0).replace(/\s*\n\s*/g, ' '); }
function isRec(v) { return v !== null && typeof v === 'object' && !(v instanceof Error) && !(typeof Element !== 'undefined' && v instanceof Element); }
function tableLines(data) {
  if (!isRec(data)) return null;
  const rows = Array.isArray(data) ? Array.from(data, function (v, i) { return [String(i), v]; }) : Object.keys(data).map(function (k) { return [k, data[k]]; });
  const cols = [];
  let hasValues = false;
  rows.forEach(function (r) {
    const v = r[1];
    if (isRec(v)) (Array.isArray(v) ? Array.from(v, function (x, i) { return String(i); }) : Object.keys(v)).forEach(function (c) { if (cols.indexOf(c) < 0) cols.push(c); });
    else hasValues = true;
  });
  const head = ['(index)'].concat(cols, hasValues ? ['Values'] : []);
  const body = rows.map(function (r) {
    const v = r[1];
    return [r[0]].concat(cols.map(function (c) { return isRec(v) && Object.prototype.hasOwnProperty.call(v, c) ? cell(v[c]) : ''; }), hasValues ? [isRec(v) ? '' : cell(v)] : []);
  });
  const len = function (t) { return Array.from(t).length; };
  const w = head.map(function (h, i) { return Math.max.apply(null, [len(h)].concat(body.map(function (r) { return len(r[i]); }))); });
  const pad = function (t, n) { return t + ' '.repeat(n - len(t)); };
  const line = function (l, m, r) { return l + w.map(function (n) { return '─'.repeat(n + 2); }).join(m) + r; };
  const row = function (r) { return '│ ' + r.map(function (t, i) { return pad(t, w[i]); }).join(' │ ') + ' │'; };
  return [line('┌', '┬', '┐'), row(head), line('├', '┼', '┤')].concat(body.map(row), [line('└', '┴', '┘')]);
}
console.table = function (data) {
  const out = tableLines(data);
  if (!out) return send('log', fmt(data));
  out.forEach(function (l) { send('log', l); });
};
console.trace = function () { send('log', ['console.trace'].concat(Array.prototype.map.call(arguments, function (x) { return fmt(x); })).join(' ')); };
addEventListener('error', function (e) { send('err', e.error && e.error.name ? e.error.name + ': ' + e.error.message : e.message); });
addEventListener('unhandledrejection', function (e) {
  const r = e.reason;
  send('err', r && r.name ? r.name + ': ' + r.message : 'Uncaught (in promise) ' + String(r));
});

// heartbeat: lets the parent tell "main thread stuck in a sync loop" from "waiting on async work"
const _st = setTimeout, _ct = clearTimeout, _si = setInterval, _ci = clearInterval;
const _raf = window.requestAnimationFrame && window.requestAnimationFrame.bind(window);
const _caf = window.cancelAnimationFrame && window.cancelAnimationFrame.bind(window);
send('beat');
_si(function () { send('beat'); }, 500);

// pending-work tracking
const timers = new Set(), ivals = new Set(), rafs = new Set();
let net = 0, hold = 0, started = false, ended = false, checking = false;
function idle() { return !timers.size && !ivals.size && !rafs.size && !net && !hold; }
function check() {
  if (!started || ended || checking) return;
  checking = true;
  // flush microtasks, then a macrotask, then look again
  Promise.resolve().then(function () {
    _st(function () {
      checking = false;
      if (idle() && !ended) { ended = true; send('done'); }
    }, 10);
  });
}
window.setTimeout = function (fn, ms) {
  if (typeof fn !== 'function') return _st(fn, ms);
  const args = Array.prototype.slice.call(arguments, 2);
  const t = _st(function () {
    timers.delete(t);
    try { fn.apply(this, args); } finally { check(); }
  }, ms);
  timers.add(t);
  return t;
};
window.clearTimeout = function (t) { timers.delete(t); ivals.delete(t); _ct(t); check(); };
window.setInterval = function (fn, ms) {
  if (typeof fn !== 'function') return _si(fn, ms);
  const args = Array.prototype.slice.call(arguments, 2);
  const t = _si(function () { fn.apply(this, args); }, ms);
  ivals.add(t);
  return t;
};
window.clearInterval = function (t) { ivals.delete(t); timers.delete(t); _ci(t); check(); };
if (_raf) {
  window.requestAnimationFrame = function (cb) {
    const t = _raf(function (ts) {
      rafs.delete(t);
      try { cb(ts); } finally { check(); }
    });
    rafs.add(t);
    return t;
  };
  window.cancelAnimationFrame = function (t) { rafs.delete(t); _caf(t); check(); };
}
const _fetch = window.fetch.bind(window);
window.fetch = function () {
  net++;
  return _fetch.apply(null, arguments).then(
    function (r) { net--; check(); return r; },
    function (e) { net--; check(); throw e; }
  );
};
['json', 'text', 'blob', 'arrayBuffer', 'formData'].forEach(function (m) {
  const orig = Response.prototype[m];
  Response.prototype[m] = function () {
    net++;
    return orig.apply(this, arguments).then(
      function (v) { net--; check(); return v; },
      function (e) { net--; check(); throw e; }
    );
  };
});
window.__ilmHold = function (p) {
  hold++;
  return Promise.resolve(p).finally(function () { hold--; check(); });
};
window.__ilmEnd = function () { started = true; check(); };

if (MODE !== 'console') {
  let lastH = -1;
  const report = function () {
    const b = document.body;
    if (!b) return;
    const h = Math.ceil(b.getBoundingClientRect().bottom + (parseFloat(getComputedStyle(b).marginBottom) || 0));
    if (h !== lastH) { lastH = h; send('height', h); }
  };
  addEventListener('DOMContentLoaded', function () {
    report();
    if (window.ResizeObserver) new ResizeObserver(report).observe(document.body);
  });
  addEventListener('load', report);
}
})();
`;

type Pending = {
  id: string;
  mode: RunSpec['mode'];
  frame: HTMLIFrameElement;
  own: boolean;
  lines: OutLine[];
  hadError: boolean;
  done: boolean;
  lastBeat: number;
  monitor?: ReturnType<typeof setInterval>;
  cap?: ReturnType<typeof setTimeout>;
  opts: RunOptions;
  resolve: (r: RunResult) => void;
};

const runs = new Map<string, Pending>();
let seq = 0;
let listening = false;

type Msg = { ilmRun?: string; kind?: string; text?: unknown };

function emit(r: Pending) {
  r.opts.onLines?.(r.lines.slice());
}

function push(r: Pending, line: OutLine) {
  if (r.lines.length > MAX_LINES) return;
  if (r.lines.length === MAX_LINES) line = { text: r.opts.strings.runner.tooMany, cls: 'warn-line' };
  r.lines.push(line);
  emit(r);
}

function clearTimers(r: Pending) {
  clearInterval(r.monitor);
  clearTimeout(r.cap);
}

/** The run is complete: resolve the promise. Own frames are removed; visible frames stay alive. */
function finish(r: Pending) {
  if (r.done) return;
  r.done = true;
  clearTimers(r);
  if (r.mode === 'console' && !r.lines.length) r.lines.push({ text: r.opts.strings.runner.empty, cls: 'empty' });
  emit(r);
  if (r.own) {
    r.frame.remove();
    runs.delete(r.id);
  }
  r.resolve({ lines: r.lines, hadError: r.hadError });
}

/** Kill the frame content (stuck loop / cap in console mode). */
function kill(r: Pending) {
  if (r.own) r.frame.remove();
  else r.frame.srcdoc = '<!doctype html><title></title>';
}

/** Cancel a run (superseded by a new one / unmounted). */
function stop(r: Pending) {
  clearTimers(r);
  runs.delete(r.id);
  if (!r.done) {
    r.done = true;
    if (r.own) r.frame.remove();
    r.resolve({ lines: r.lines, hadError: r.hadError });
  }
}

function onMessage(e: MessageEvent) {
  const d = e.data as Msg | null;
  const id = d && d.ilmRun;
  const r = id ? runs.get(id) : undefined;
  if (!id || !d || !r || e.source !== r.frame.contentWindow) return;
  if (d.kind === 'beat') {
    r.lastBeat = performance.now();
  } else if (d.kind === 'height') {
    const h = Number(d.text);
    if (Number.isFinite(h)) r.opts.onHeight?.(h);
  } else if (d.kind === 'done') {
    finish(r);
  } else if (d.kind === 'err') {
    const msg = cap(String(d.text)).replace(/^Uncaught\s+(\(in promise\)\s*)?/, '');
    r.hadError = true;
    push(r, { text: '✖ ' + msg, cls: 'err' });
    const hint = explain(msg, r.opts.strings.explain);
    if (hint) push(r, { text: '↳ ' + hint, cls: 'warn-line' });
  } else {
    push(r, { text: cap(String(d.text)), cls: d.kind === 'warn' ? 'warn-line' : d.kind === 'error' ? 'err' : '' });
  }
}

const MAX_LINE = 2000;
const cap = (s: string) => (s.length > MAX_LINE ? s.slice(0, MAX_LINE) + '…' : s);

const safe = (s: string) => s.replace(/<\/script/gi, '<\\/script');
const safeStyle = (s: string) => s.replace(/<\/style/gi, '<\\/style');

const bootScript = (id: string, mode: string) =>
  `<script>${safe('const ID = ' + JSON.stringify(id) + ', MODE = ' + JSON.stringify(mode) + ';\n' + BOOT)}<\/script>`;

const BASE_CSS =
  'html{color-scheme:light}body{margin:0;padding:12px;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1c2230;background:#fff}';
/**
 * Student code becomes a blob module mapped (import map, injected by a classic script) to the bare
 * specifier "ilm-user". An inline module script imports it (so it runs at the usual place, before
 * DOMContentLoaded); a second module script re-imports the same module record, so it resumes only after
 * the student module has fully evaluated, including top-level await, and then signals the end.
 * Errors (syntax / runtime) are reported by the first script through the window error event, as before;
 * the second one just swallows them. blob: is allowed by our CSP (data: is not).
 */
const userModule = (code: string) =>
  `<script>(function(){var s=document.createElement('script');s.type='importmap';` +
  `s.textContent=JSON.stringify({imports:{'ilm-user':URL.createObjectURL(new Blob([${safe(JSON.stringify(code))}],{type:'text/javascript'}))}});` +
  `document.currentScript.after(s);})()<\/script>`;
const studentScript = `<script type="module">import 'ilm-user';<\/script>`;
const endScript = `<script type="module">try { await import('ilm-user'); } catch {} __ilmEnd();<\/script>`;
const END = `<script type="module">__ilmEnd()<\/script>`;

function consoleDoc(id: string, code: string) {
  // module: own scope (const top / name don't clash with window), strict mode, order kept
  return bootScript(id, 'console') + userModule(code) + studentScript + endScript;
}

function domDoc(id: string, s: { html: string; css: string; js: string }) {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>${BASE_CSS}</style><style>${safeStyle(s.css)}</style>${bootScript(id, 'dom')}${userModule(s.js)}</head><body>${s.html}` +
    `${studentScript}${endScript}</body></html>`
  );
}

function reactDoc(id: string, js: string, css: string, rs: Messages['runner']) {
  const main = `
const CODE = ${JSON.stringify(js)};
__ilmHold((async () => {
  let React, ReactDOM;
  try { React = await import('react'); ReactDOM = await import('react-dom/client'); }
  catch (e) { console.error(${JSON.stringify(rs.noReact)}); return; }
  const url = URL.createObjectURL(new Blob([CODE], { type: 'text/javascript' }));
  const mod = await import(url);
  const App = mod.default || mod.App;
  if (typeof App !== 'function') throw new Error(${JSON.stringify(rs.noApp)});
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
})());`;
  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>${BASE_CSS}</style><style>${safeStyle(css)}</style>${bootScript(id, 'react')}` +
    `<script type="importmap">${IMPORT_MAP}<\/script></head><body><div id="root"></div>` +
    `<script type="module">${safe(main)}<\/script>${END}</body></html>`
  );
}

async function buildReact(id: string, jsx: string, css: string, rs: Messages['runner']): Promise<string> {
  const { transform } = await import('sucrase');
  const out = transform(jsx, { transforms: ['typescript', 'jsx'], jsxRuntime: 'automatic', production: true }).code;
  return reactDoc(id, out, css, rs);
}

/**
 * Run student code in a sandboxed iframe (allow-scripts + allow-forms so submit works; no same-origin, no parent access).
 * Results come back via postMessage keyed by run id; `e.source` is checked against the frame.
 * Watchdog: the frame sends a heartbeat; no beat for 3 s => stuck sync loop => frame removed.
 * Async work (timers, intervals, rAF, fetch) is tracked inside the frame; 'done' is posted when nothing
 * is pending, or the run is cut at 8 s. Caveat: in some browsers an infinite loop in a srcdoc iframe
 * can still block the main thread before the watchdog fires; nothing we can do client-side.
 */
export function startRun(spec: RunSpec, opts: RunOptions): Job {
  if (!listening) {
    window.addEventListener('message', onMessage);
    listening = true;
  }
  const id = 'r' + ++seq;
  let frame = opts.frame;
  const own = !frame;
  if (!frame) {
    frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-forms');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    // not display:none: rAF would not tick in a hidden frame
    frame.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
  } else {
    // a previous run on this frame is superseded
    for (const old of [...runs.values()]) if (old.frame === frame) stop(old);
  }

  let resolve!: (r: RunResult) => void;
  const result = new Promise<RunResult>((res) => (resolve = res));
  const r: Pending = { id, mode: spec.mode, frame, own, lines: [], hadError: false, done: false, lastBeat: performance.now(), opts, resolve };
  runs.set(id, r);

  r.monitor = setInterval(() => {
    if (document.hidden) r.lastBeat = performance.now(); // timers are throttled in background tabs
    else if (performance.now() - r.lastBeat > LOOP_MS) {
      r.hadError = true;
      push(r, { text: opts.strings.runner.loop, cls: 'err' });
      clearTimers(r);
      kill(r);
      r.done = true;
      emit(r);
      runs.delete(id);
      resolve({ lines: r.lines, hadError: true });
    }
  }, 500);
  r.cap = setTimeout(() => {
    if (r.done) return;
    if (spec.mode === 'console') {
      push(r, { text: opts.strings.runner.cap, cls: 'warn-line' });
      kill(r);
    }
    finish(r);
  }, CAP_MS);

  const start = (doc: string) => {
    if (r.done) return;
    r.lastBeat = performance.now();
    frame.srcdoc = doc;
    if (own) document.body.append(frame);
  };
  if (spec.mode === 'console') start(consoleDoc(id, spec.code));
  else if (spec.mode === 'dom') start(domDoc(id, spec));
  else
    buildReact(id, spec.jsx, spec.css, opts.strings.runner).then(start, (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      r.hadError = true;
      push(r, { text: '✖ SyntaxError: ' + msg, cls: 'err' });
      const hint = explain('SyntaxError: ' + msg, opts.strings.explain);
      if (hint) push(r, { text: '↳ ' + hint, cls: 'warn-line' });
      finish(r);
    });

  return { id, result, stop: () => stop(r) };
}

/** Console mode shortcut (kept for callers that just want the final result). */
export function run(code: string, opts: RunOptions): Promise<RunResult> {
  return startRun({ mode: 'console', code }, opts).result;
}
