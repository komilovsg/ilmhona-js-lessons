import { explain } from './explain';

export type OutLine = { text: string; cls: '' | 'err' | 'warn-line' | 'empty' };
export type RunResult = { lines: OutLine[]; hadError: boolean };

const TIMEOUT_MS = 3000;

/**
 * Code that runs INSIDE the sandboxed iframe: console-style value formatter + console patch.
 * Kept as a plain string (never Function.prototype.toString of transpiled code).
 * NOTE: String.raw keeps backslashes; do not use backticks or dollar-brace in here.
 * `ID` is prepended by the runner.
 */
const BOOT = String.raw`
function fmt(v, depth, seen) {
  depth = depth || 0;
  seen = seen || new Set();
  const IDENT = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;
  if (typeof v === 'string') return depth ? '"' + v + '"' : v;
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (typeof v === 'function') return 'ƒ ' + (v.name || 'anonymous') + '()';
  if (v === null || typeof v !== 'object') return String(v);
  if (v instanceof Error) return v.name + ': ' + v.message;
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
const send = (kind, text) => parent.postMessage({ ilmRun: ID, kind: kind, text: text }, '*');
for (const k of ['log', 'info', 'debug', 'table', 'warn', 'error'])
  console[k] = (...a) => send(k, a.map(x => fmt(x)).join(' '));
addEventListener('error', e => send('err', e.error && e.error.name ? e.error.name + ': ' + e.error.message : e.message));
`;

type Pending = {
  frame: HTMLIFrameElement;
  lines: OutLine[];
  hadError: boolean;
  timer: ReturnType<typeof setTimeout>;
  resolve: (r: RunResult) => void;
};

const runs = new Map<string, Pending>();
let seq = 0;
let listening = false;

type Msg = { ilmRun?: string; kind?: string; text?: unknown };

function finish(id: string, r: Pending) {
  clearTimeout(r.timer);
  r.frame.remove();
  runs.delete(id);
  r.resolve({ lines: r.lines, hadError: r.hadError });
}

function onMessage(e: MessageEvent) {
  const d = e.data as Msg | null;
  const id = d && d.ilmRun;
  const r = id ? runs.get(id) : undefined;
  if (!id || !d || !r || e.source !== r.frame.contentWindow) return;
  if (d.kind === 'done') {
    if (!r.lines.length) r.lines.push({ text: '(ничего не выведено — добавьте console.log)', cls: 'empty' });
    finish(id, r);
  } else if (d.kind === 'err') {
    const msg = String(d.text).replace(/^Uncaught\s+/, '');
    r.hadError = true;
    r.lines.push({ text: '✖ ' + msg, cls: 'err' });
    const hint = explain(msg);
    if (hint) r.lines.push({ text: '↳ ' + hint, cls: 'warn-line' });
  } else {
    if (d.kind === 'error') r.hadError = true;
    r.lines.push({ text: String(d.text), cls: d.kind === 'warn' ? 'warn-line' : d.kind === 'error' ? 'err' : '' });
  }
}

const safe = (s: string) => s.replace(/<\/script/gi, '<\\/script');

/**
 * Run student code in a sandboxed iframe (allow-scripts only: no same-origin, no parent access).
 * Results come back via postMessage keyed by run id; `e.source` is checked against the frame.
 * Timeout (3s) removes the iframe. Caveat: in some browsers an infinite loop in a srcdoc
 * iframe can still block the main thread before the timer fires; nothing we can do client-side.
 */
export function run(code: string): Promise<RunResult> {
  if (!listening) {
    window.addEventListener('message', onMessage);
    listening = true;
  }
  return new Promise((resolve) => {
    const id = 'r' + ++seq;
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.hidden = true;
    const boot = 'const ID = ' + JSON.stringify(id) + ';\n' + BOOT;
    frame.srcdoc =
      `<script>${safe(boot)}<\/script>` +
      // type="module": own scope (const top / name don't clash with window), strict mode, order kept
      `<script type="module">\n${safe(code)}\n<\/script>` +
      `<script type="module">parent.postMessage({ ilmRun: ${JSON.stringify(id)}, kind: 'done' }, '*')<\/script>`;
    const r: Pending = {
      frame,
      lines: [],
      hadError: false,
      resolve,
      timer: setTimeout(() => {
        r.hadError = true;
        r.lines.push({ text: '⏱ Код выполняется слишком долго (возможен бесконечный цикл)', cls: 'err' });
        finish(id, r);
      }, TIMEOUT_MS),
    };
    runs.set(id, r);
    document.body.append(frame);
  });
}
