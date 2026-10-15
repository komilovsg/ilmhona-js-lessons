// Pure PII redaction, used on the client (before sending) and on the server (before the model call).
// Pragmatic, not perfect: it prefers hiding too much in prose and too little inside code.
export const HIDDEN = '[скрыто]';

/** Case-insensitive literal for a phrase ("меня зовут" -> "[Мм][Ее]..."), so the rest of a regex can stay case-sensitive. */
const ci = (phrase: string) =>
  phrase
    .split(' ')
    .map((w) => [...w].map((c) => (c.toLowerCase() === c.toUpperCase() ? c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : `[${c.toUpperCase()}${c.toLowerCase()}]`)).join(''))
    .join('\\s+');
const NB = '(?<![\\p{L}\\p{N}_])'; // word start that also works for Cyrillic (\b is ASCII-only)
const NE = '(?![\\p{L}\\p{N}_])';

const AT = '(?:\\s*[@＠]\\s*|\\s*[([{]\\s*(?:at|собака)\\s*[)\\]}]\\s*|\\s+собак[аи]\\s+)';
const DOT = '(?:\\s*\\.\\s*|\\s*[([{]\\s*(?:dot|точка)\\s*[)\\]}]\\s*|\\s+точка\\s+)';
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const EMAIL_LOOSE = new RegExp(`(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+${AT}[A-Za-z0-9-]+(?:${DOT}[A-Za-z]{2,10})+(?![A-Za-z0-9-])`, 'giu');
const SECRET_URL = /(?:https?:\/\/)?[^\s"'`<>]+[?&](?:token|access_token|id_token|key|api_?key|secret|password|pass|auth|sig|session|sid|code)=[^\s"'`<>&]*[^\s"'`<>]*/gi;
const TME = /\b(?:https?:\/\/)?(?:t\.me|telegram\.me)\/[A-Za-z0-9_+]+/gi;
const TG_WORD = new RegExp(`(${NB}(?:тг|tg|телеграмм?|телега|telegram)(\\s*[:-]\\s*|\\s+))(@?)([A-Za-z][A-Za-z0-9_]{3,31})${NE}`, 'giu');
const PHONE_PLUS = /(?<![\w+])\+\d[\d\s\-().]{6,}\d/g;
const PHONE_992 = /(?<!\d)992[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/g;
// Any run of 7+ digits with short separators; isPhone() decides by shape and context.
const DIGIT_RUN = /(?<![\w.+,-])\+?\(?\d(?:[\s\-.()]{0,2}\d){6,14}(?![\w]|[.,]\d)/g;
const PHONE_WORD = /(?:тел|phone|номер|рақам|tel|звон|whats|ватсап|вацап|вайбер|viber|моб)[\p{L}.]*\s*[:\-№#]?\s*$/iu;
const HANDLE = /(?<![\w@.])@(?!(?:media|import|keyframes|font-face|supports|charset|layer|container|apply|tailwind|mixin|include|extend|returns?|param|example|override|property|namespace|scope)\b)[A-Za-z][A-Za-z0-9_]{4,31}\b/g;
const PASSPORT = /\b[A-Z]{1,2}\d{7}\b/g;
const PASSPORT_WORD = /(паспорт\w*(?:\s+(?:№|номер|серия))?\s*)[A-ZА-Я]{0,2}\s?\d{6,10}/gi;

/** Phone shape: +country, 992..., 8/7 + 10 digits, a 9-digit local number starting with 9 grouped like a phone, or any 7+ digits right after a phone keyword. */
function isPhone(m: string, before: string): boolean {
  const d = m.replace(/\D/g, '');
  if (PHONE_WORD.test(before.slice(-30))) return d.length >= 7;
  if (m.startsWith('+')) return d.length >= 9;
  if (/^992\d{9}$/.test(d)) return true;
  if (/^[78]9\d{9}$/.test(d)) return true;
  if (/^9\d{8}$/.test(d)) {
    const groups = m.split(/[\s\-.()]+/).filter(Boolean).map((g) => g.length).join('-');
    return ['9', '2-3-2-2', '3-2-2-2', '2-3-4', '2-2-2-3', '1-1-1-1-1-1-1-1-1', '2-7', '3-6'].includes(groups);
  }
  return false;
}

const NAME_WORD = "[A-ZА-ЯЁҶҒҚӢӮҲ][A-Za-zА-Яа-яЁёҶҷҒғҚқӢӣӮӯҲҳ'-]+";
const NAME3 = `${NAME_WORD}(?:\\s+${NAME_WORD}){0,2}`;
const ANY_WORD = "[A-Za-zА-Яа-яЁёҶҷҒғҚқӢӣӮӯҲҳ'-]+";
const CYR_NAME = '[А-ЯЁҶҒҚӢӮҲ][а-яёҷғқӣӯҳ-]+';
const NAME_TRIGGERS = ['меня зовут', 'моё фио', 'мое фио', 'моя фамилия', 'моё имя', 'мое имя', 'my name is', 'номи ман', 'фамилияи ман', 'номам']
  .map(ci)
  .join('|');
const AGE_WORDS = `${ANY_WORD}(?:\\s+${ANY_WORD})?`;
const NOT_DONE = '(?!\\[скрыто\\])'; // keeps redaction idempotent
const NAMED: [RegExp, string][] = [
  // trigger + 1-3 capitalized words, or a single word in any case («меня зовут фаридун»)
  [new RegExp(`(${NB}(?:${NAME_TRIGGERS})\\s*[:—-]?\\s*)(?:${NAME3}|(?!(?:как|так|что|тоже|все|уже|сюда|туда)${NE})[a-zа-яёҷғқӣӯҳ]{3,}[a-zа-яёҷғқӣӯҳ'-]*)`, 'gu'), `$1${HIDDEN}`],
  // «Я Фаридун Каримов» at the start of a sentence
  [new RegExp(`((?:^|[.!?\\n]\\s*)[Яя]\\s+)${CYR_NAME}\\s+${CYR_NAME}`, 'gu'), `$1${HIDDEN}`],
  // Tajik «ман Фаридун ҳастам»
  [new RegExp(`(${NB}${ci('ман')}\\s+)${NAME_WORD}(?:\\s+${NAME_WORD})?(?=\\s+ҳастам)`, 'gu'), `$1${HIDDEN}`],
  // ages: «мне 15 лет», «мне пятнадцать лет», «ман 15-сола», «ман 15 сол дорам»
  [new RegExp(`(${NB}${ci('мне')}\\s+(?:(?:уже|почти|скоро|только)\\s+)?)(?:\\d{1,2}|${AGE_WORDS})(?=\\s+(?:лет|года?)${NE})`, 'gu'), `$1${HIDDEN}`],
  [new RegExp(`(${NB}${ci('ман')}\\s+)(?:\\d{1,2}|${ANY_WORD})(?=\\s*-?\\s*(?:сола|солаам|сол)${NE})`, 'gu'), `$1${HIDDEN}`],
  [/([Яя] родил(?:ся|ась)\s+)[^\n.!?]{1,40}/g, `$1${HIDDEN}`],
  [/([Мм]ан таваллуд шудаам?\s+)[^\n.!?]{1,40}/g, `$1${HIDDEN}`],
  // addresses
  [/((?:[Жж]иву по адресу|[Мм]ой адрес|[Аа]дрес проживания|[Сс]уроғаи ман|[Дд]ар суроға зиндагӣ мекунам)[:\s]+)[^\n!?]{1,80}/g, `$1${HIDDEN}`],
  [new RegExp(`(${NB}${ci('живу')}\\s+(?:в|во|на|по|около|возле|рядом с)\\s+)(?!адресу)${NOT_DONE}[^\\n!?]{1,80}`, 'gu'), `$1${HIDDEN}`],
  [new RegExp(`(${NB}(?:ул\\.|улиц[аеуы]|${ci('кӯчаи')}|${ci('кучаи')}|просп\\.|проспект[ае]?|мкр\\.?|микрорайон[ае]?)\\s*)${NOT_DONE}[^\\n,;!?]{1,40}`, 'giu'), `$1${HIDDEN}`],
];

const digits = (s: string) => s.replace(/\D/g, '').length;

function apply(text: string, re: RegExp, to: string | ((m: string, ...a: unknown[]) => string), onHit: () => void): string {
  const out = typeof to === 'function' ? text.replace(re, to) : text.replace(re, to);
  if (out !== text) onHit();
  return out;
}

function phones(s: string, hit: () => void): string {
  return apply(s, DIGIT_RUN, (m, off, all) => (isPhone(m, (all as string).slice(0, off as number)) ? HIDDEN : m), hit);
}

const KEY = '(?:name|full_?name|first_?name|last_?name|surname|имя|фио|age|возраст|phone|tel|mobile|email|e_?mail|address|city|адрес|город)';
// `name = "Ali"`, `"phone": '+992…'`, `age: 15` -> value hidden. Comparisons (===) are left alone.
const KEY_VALUE = new RegExp(`(${NB}["']?${KEY}["']?\\s*(?::|=(?!=))\\s*)(?:(["'\`])(?:(?!\\2)[^\\\\\\n]|\\\\.)*\\2|\\d[\\d\\s\\-().+]*\\d|\\d)`, 'giu');
const STRING_LIT = /(["'`])((?:(?!\1)[^\\\n]|\\.){7,40})\1/g;

/** Rules for code and console output: no guessing on bare numbers, no @handles (CSS at-rules, decorators). */
function redactCode(text: string, hit: () => void): string {
  let s = text;
  s = apply(s, SECRET_URL, HIDDEN, hit);
  s = apply(s, EMAIL, HIDDEN, hit);
  s = apply(s, PHONE_PLUS, (m) => (digits(m) >= 9 ? HIDDEN : m), hit);
  s = apply(s, PHONE_992, HIDDEN, hit);
  s = apply(s, KEY_VALUE, (_m, pre, q) => `${pre}${q ? `${q}${HIDDEN}${q}` : HIDDEN}`, hit);
  // string literals that are a phone: "931234567", '93 123 45 67'
  s = apply(s, STRING_LIT, (m, q, body) => (/^[\d\s\-.()+]+$/.test(body as string) && isPhone((body as string).trim(), '') ? `${q}${HIDDEN}${q}` : m), hit);
  return s;
}

function redactProse(text: string, hit: () => void): string {
  let s = text.normalize('NFKC'); // full-width ＠ and digits become plain ones
  for (const [re, to] of NAMED) s = apply(s, re, to, hit);
  s = apply(s, SECRET_URL, HIDDEN, hit);
  s = apply(s, TME, HIDDEN, hit);
  s = apply(s, EMAIL, HIDDEN, hit);
  s = apply(s, EMAIL_LOOSE, HIDDEN, hit);
  s = apply(s, TG_WORD, (m, pre, sep, at, h) => (at || /:/.test(sep as string) || /[\d_]/.test(h as string) ? `${pre}${HIDDEN}` : m), hit);
  s = apply(s, PASSPORT_WORD, `$1${HIDDEN}`, hit);
  s = apply(s, PHONE_PLUS, (m) => (digits(m) >= 9 ? HIDDEN : m), hit);
  s = apply(s, PHONE_992, HIDDEN, hit);
  s = phones(s, hit);
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
