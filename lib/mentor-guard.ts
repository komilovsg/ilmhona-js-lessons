// Output guard for the mentor relay: catches replies where the model talks about ITSELF as a vendor model.
// The course teaches ChatGPT / Claude / Gemini / Copilot as tools, so a plain mention is fine; only a
// self-reference in the same sentence ("я — Gemini", "меня создал Google", "основан на GPT") is a leak.
// Best effort only: encoded leaks (char codes, base64, reversed text, translit split across sentences)
// cannot be filtered by pattern matching. The system prompt is the first line of defence; this is the net.

// Cyrillic / Greek letters that look like Latin ones. Text AND patterns go through the same fold, so
// Cyrillic vendor names (джемини) still match after folding.
const HOMO: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', п: 'n', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', и: 'u',
  і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ӏ: 'l', ԛ: 'q', ԝ: 'w', ү: 'y', һ: 'h',
  α: 'a', β: 'b', γ: 'y', ε: 'e', η: 'n', ι: 'i', κ: 'k', μ: 'u', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ω: 'w',
  ı: 'i', ɡ: 'g', ɑ: 'a',
};

/** NFKC (full-width, math letters), lowercase, drop accents and invisible chars, fold homoglyphs. Non-letters become spaces. */
export function fold(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\p{M}\p{Cf}]/gu, '')
    .replace(/./gu, (c) => HOMO[c] ?? c)
    .replace(/[^\p{L}]+/gu, ' ');
}
const words = (s: string) => fold(s).split(' ').filter(Boolean);

// Matched against the sentence with all non-letters removed, so "G e m i n i" / "g.e.m.i.n.i" / "Gem​ini" still hit.
const VENDOR_COMPACT = ['gemini', 'gemma', 'google', 'deepmind', 'openai', 'chatgpt', 'anthropic', 'claude', 'llama', 'mistral', 'vertexai', 'metaai'];
// Short or ambiguous names: whole words only (after folding).
const VENDOR_WORD = new Set(['gpt', 'bard', 'palm', 'vertex', 'клод', 'клода', 'клоду', 'клодом', 'клоде'].map((w) => words(w)[0]));
// Cyrillic names as word prefixes ("гуглом", "антропика"); folded like the text.
const VENDOR_PREFIX = ['джемини', 'гемини', 'гугл', 'чатгпт', 'антропик', 'дипмайнд', 'опенаи'].map((w) => words(w)[0]);

const SELF = new Set(['я', 'меня', 'мной', 'мне', 'моя', 'мой', 'моё', 'мое', 'мою', 'моей', 'моего', 'ман', 'маро', 'манро', 'my', 'me', 'myself'].map((w) => words(w)[0]));
const SELF_PAIRS = [['i', 'am'], ['i', 'm']];
// Identity verbs that point at "what I am" even without a pronoun.
const IDENTITY = ['работаю', 'основан', 'основана', 'построен', 'создан', 'создана', 'разработан', 'обучен', 'обучена', 'модель', 'моделью', 'model', 'powered', 'built', 'trained', 'сохта', 'сохтааст'].map((w) => words(w)[0]);

function isVendorWord(w: string): boolean {
  return VENDOR_WORD.has(w) || VENDOR_PREFIX.some((p) => w.startsWith(p)) || VENDOR_COMPACT.includes(w);
}

/** Does this text mention a vendor at all (any spelling we can see)? */
export function mentionsVendor(text: string): boolean {
  const ws = words(text);
  if (ws.some(isVendorWord)) return true;
  const compact = ws.join('');
  return VENDOR_COMPACT.some((v) => compact.includes(v));
}

function sentenceLeaks(sentence: string): boolean {
  if (!mentionsVendor(sentence)) return false;
  const ws = words(sentence);
  if (ws.some((w) => SELF.has(w) || IDENTITY.includes(w))) return true;
  return SELF_PAIRS.some(([a, b]) => ws.some((w, i) => w === a && ws[i + 1] === b));
}

// Sentence end: . ! ? … followed by whitespace/end, or a line break. "g.e.m.i.n.i" does not split.
const BOUNDARY = /[.!?…]+(?=\s|$)|\n+/g;

function sentences(text: string): { start: number; end: number; closed: boolean }[] {
  const out: { start: number; end: number; closed: boolean }[] = [];
  let start = 0;
  for (const m of text.matchAll(BOUNDARY)) {
    const end = m.index + m[0].length;
    out.push({ start, end, closed: true });
    start = end;
  }
  if (start < text.length) out.push({ start, end: text.length, closed: false });
  return out;
}

/** True when any sentence of the reply has the model naming itself as a vendor model. */
export function leaksIdentity(text: string): boolean {
  return sentences(text).some((s) => sentenceLeaks(text.slice(s.start, s.end)));
}

/**
 * For the streaming relay: is there a leak so far, and how many chars are safe to send?
 * An unfinished sentence that already names a vendor is held back until it ends, so a self-reference
 * arriving after the name ("Gemini — это я") is still caught before the name goes out.
 */
export function scanReply(acc: string, final: boolean): { leak: boolean; safe: number } {
  let safe = acc.length;
  for (const s of sentences(acc)) {
    const text = acc.slice(s.start, s.end);
    if (sentenceLeaks(text)) return { leak: true, safe: 0 };
    if (!s.closed && !final && mentionsVendor(text)) safe = s.start;
  }
  return { leak: false, safe };
}

export const OFF = '__OFF_TOPIC__';
export const WHO = '__IDENTITY__';
export type Sentinel = 'off' | 'who';

/** Sentinel at the start of the reply: matched / maybe (still a prefix) / none. At the end of the stream a bare prefix counts as matched. */
export function leadingSentinel(acc: string, final: boolean): Sentinel | 'maybe' | null {
  const t = acc.trimStart();
  if (t.startsWith(OFF)) return 'off';
  if (t.startsWith(WHO)) return 'who';
  if (!t) return final ? null : 'maybe';
  const off = OFF.startsWith(t);
  const who = WHO.startsWith(t);
  if (!off && !who) return null;
  if (!final) return 'maybe';
  return who && !off ? 'who' : 'off'; // "__" alone is ambiguous: treat as off-topic
}

/** Sentinel anywhere in the text (the model mixed it into an answer). */
export function innerSentinel(acc: string): Sentinel | null {
  const m = acc.match(/__(OFF_TOPIC|IDENTITY)__/);
  return m ? (m[1] === 'IDENTITY' ? 'who' : 'off') : null;
}

/** Largest index <= n that does not cut a UTF-16 surrogate pair in half. */
export function safeCut(s: string, n: number): number {
  if (n > 0 && n < s.length) {
    const c = s.charCodeAt(n - 1);
    if (c >= 0xd800 && c <= 0xdbff) return n - 1;
  }
  return n;
}

/** Separator between the streamed reply and its signature. A control char, stripped from model text. */
export const SIG_SEP = '\u001e';
/** Tail kept back so a vendor name split across chunks (or spelled out with spaces) is caught before it is sent. */
export const HOLD = 32;

/**
 * Streams model text deltas to the student through the guards: sentinels at the start become the fixed
 * lines, a sentinel or self-identification later cuts the reply with the matching fixed line.
 * A completed reply ends with SIG_SEP + sign(delivered text); an aborted one has no signature.
 */
export function guardStream(
  next: () => Promise<string | null>,
  opts: {
    fixed: Record<Sentinel, string>;
    sign: (text: string) => string;
    onCancel?: () => void;
    /** Called once when the reply ends: normal answer, a fixed line (off / who), a stream error, or a client cancel ('ok'). */
    onDone?: (kind: 'ok' | Sentinel | 'error') => void;
  },
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let reported = false;
  const done = (kind: 'ok' | Sentinel | 'error') => {
    if (reported) return;
    reported = true;
    try {
      opts.onDone?.(kind);
    } catch {}
  };
  let acc = '';
  let sent = 0;
  let delivered = '';
  let over = false;
  return new ReadableStream({
    async pull(c) {
      const emit = (t: string) => {
        if (!t) return;
        delivered += t;
        c.enqueue(enc.encode(t));
      };
      const end = (kind: 'ok' | Sentinel = 'ok') => {
        over = true;
        done(kind);
        const sig = delivered ? opts.sign(delivered) : '';
        if (sig) c.enqueue(enc.encode(SIG_SEP + sig));
        c.close();
      };
      const finish = (kind: Sentinel) => {
        opts.onCancel?.();
        emit((sent ? '\n\n' : '') + opts.fixed[kind]);
        end(kind);
      };
      try {
        while (!over) {
          const d = await next();
          const final = d === null;
          if (d) acc += d.replaceAll(SIG_SEP, '');
          if (sent === 0) {
            const s = leadingSentinel(acc, final);
            if (s === 'off' || s === 'who') return finish(s);
            if (s === 'maybe') continue;
          }
          const inner = innerSentinel(acc);
          if (inner) return finish(inner);
          const r = scanReply(acc, final);
          if (r.leak) return finish('who');
          if (final) {
            emit(acc.slice(sent));
            sent = acc.length;
            return end();
          }
          const upto = safeCut(acc, Math.min(acc.length - HOLD, r.safe));
          if (upto > sent) {
            emit(acc.slice(sent, upto));
            sent = upto;
            return;
          }
        }
      } catch {
        if (!over) {
          over = true;
          done('error');
          c.close(); // no signature: the partial text is shown but not trusted as history later
        }
      }
    },
    cancel: () => {
      done('ok');
      opts.onCancel?.();
    },
  });
}
