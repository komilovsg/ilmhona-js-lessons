// Pure PII redaction, used on the client (before sending) and on the server (before the model call).
// Pragmatic, not perfect: it prefers hiding too much in prose and too little inside code.
export const HIDDEN = '[скрыто]';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const SECRET_URL = /(?:https?:\/\/)?[^\s"'`<>]+[?&](?:token|access_token|id_token|key|api_?key|secret|password|pass|auth|sig|session|sid|code)=[^\s"'`<>&]*[^\s"'`<>]*/gi;
const TME = /\b(?:https?:\/\/)?(?:t\.me|telegram\.me)\/[A-Za-z0-9_+]+/gi;
const PHONE_PLUS = /(?<![\w+])\+\d[\d\s\-().]{6,}\d/g;
const PHONE_992 = /(?<!\d)992[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/g;
const PHONE_LOCAL9 = /(?<![\d.])9\d{8}(?![\d.])/g;
const PHONE_GROUPS = /(?<![\d.])\(?\d{2,4}\)?[\s-]\d{2,4}[\s-]\d{2,4}(?:[\s-]\d{2,4})?(?![\d.])/g;
const HANDLE = /(?<![\w@.])@(?!(?:media|import|keyframes|font-face|supports|charset|layer|container|apply|tailwind|mixin|include|extend|returns?|param|example|override|property|namespace|scope)\b)[A-Za-z][A-Za-z0-9_]{4,31}\b/g;
const PASSPORT = /\b[A-Z]{1,2}\d{7}\b/g;
const PASSPORT_WORD = /(паспорт\w*(?:\s+(?:№|номер|серия))?\s*)[A-ZА-Я]{0,2}\s?\d{6,10}/gi;

const NAME_WORD = "[A-ZА-ЯЁҶҒҚӢӮҲ][A-Za-zА-Яа-яЁёҶҷҒғҚқӢӣӮӯҲҳ'-]+";
const NAME3 = `${NAME_WORD}(?:\\s+${NAME_WORD}){0,2}`;
const NAMED: [RegExp, string][] = [
  [new RegExp(`((?:[Мм]еня зовут|[Мм]оё ФИО|[Мм]ое ФИО|[Мм]оё фио|[Мм]ое фио|[Мм]оя фамилия|[Мм]ое имя|[Мм]оё имя|[Мм]y name is|[Нн]оми ман|[Фф]амилияи ман)\\s+)${NAME3}`, 'g'), `$1${HIDDEN}`],
  [/([Мм]не\s+)\d{1,2}(?=\s+(?:лет|года|год))/g, `$1${HIDDEN}`],
  [/([Мм]ан\s+)\d{1,2}(?=\s*(?:сола|солаам))/g, `$1${HIDDEN}`],
  [/([Яя] родил(?:ся|ась)\s+)[^\n.!?]{1,40}/g, `$1${HIDDEN}`],
  [/([Мм]ан таваллуд шудаам?\s+)[^\n.!?]{1,40}/g, `$1${HIDDEN}`],
  [/((?:[Жж]иву по адресу|[Мм]ой адрес|[Аа]дрес проживания|[Сс]уроғаи ман|[Дд]ар суроға зиндагӣ мекунам)[:\s]+)[^\n!?]{1,80}/g, `$1${HIDDEN}`],
];

const digits = (s: string) => s.replace(/\D/g, '').length;

function apply(text: string, re: RegExp, to: string | ((m: string) => string), onHit: () => void): string {
  const out = typeof to === 'function' ? text.replace(re, to) : text.replace(re, to);
  if (out !== text) onHit();
  return out;
}

/** Rules for code and console output: no numeric guessing, no @handles (CSS at-rules, decorators). */
function redactCode(text: string, hit: () => void): string {
  let s = text;
  s = apply(s, SECRET_URL, HIDDEN, hit);
  s = apply(s, EMAIL, HIDDEN, hit);
  s = apply(s, PHONE_PLUS, (m) => (digits(m) >= 9 ? HIDDEN : m), hit);
  s = apply(s, PHONE_992, HIDDEN, hit);
  return s;
}

function redactProse(text: string, hit: () => void): string {
  let s = text;
  for (const [re, to] of NAMED) s = apply(s, re, to as string, hit);
  s = apply(s, SECRET_URL, HIDDEN, hit);
  s = apply(s, TME, HIDDEN, hit);
  s = apply(s, EMAIL, HIDDEN, hit);
  s = apply(s, PASSPORT_WORD, `$1${HIDDEN}`, hit);
  s = apply(s, PHONE_PLUS, (m) => (digits(m) >= 9 ? HIDDEN : m), hit);
  s = apply(s, PHONE_992, HIDDEN, hit);
  s = apply(s, PHONE_LOCAL9, HIDDEN, hit);
  s = apply(s, PHONE_GROUPS, (m) => (digits(m) >= 7 ? HIDDEN : m), hit);
  s = apply(s, HANDLE, HIDDEN, hit);
  s = apply(s, PASSPORT, HIDDEN, hit);
  return s;
}

/** Chat message: ``` fenced and `inline` code get the code rules, the rest gets the prose rules. */
export function redactMessage(text: string): { text: string; hit: boolean } {
  let hit = false;
  const mark = () => void (hit = true);
  const out = text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((seg, i) => (i % 2 ? redactCode(seg, mark) : redactProse(seg, mark)))
    .join('');
  return { text: out, hit };
}

/** A whole code / output field. */
export function redactCodeField(text: string): { text: string; hit: boolean } {
  let hit = false;
  const out = redactCode(text, () => void (hit = true));
  return { text: out, hit };
}
