// Self-check: `node lib/redact.check.mjs` (Node >= 22.6 strips TS types natively).
import assert from 'node:assert/strict';
import { redactCodeField, redactMessage } from './redact.ts';

let n = 0;
const hid = (s, label = s) => {
  const r = redactMessage(s);
  assert.ok(r.hit, `should redact: ${label} -> ${r.text}`);
  assert.ok(r.text.includes('[скрыто]'), label);
  n++;
  return r.text;
};
const keep = (s) => {
  const r = redactMessage(s);
  assert.equal(r.text, s, `should keep: ${s} -> ${r.text}`);
  assert.equal(r.hit, false);
  n++;
};

assert.ok(!hid('мой email ali.jon@example.com помогите').includes('example.com'));
assert.ok(!hid('+992 90 123 45 67').includes('123'));
assert.ok(!hid('звоните 992901234567').includes('1234'));
assert.ok(!hid('номер 901234567').includes('1234'));
assert.ok(!hid('номер 90-123-45-67').includes('123'));
assert.ok(!hid('+1 (415) 555-2671').includes('555'));
assert.ok(!hid('пишите @alijon_dev').includes('alijon'));
assert.ok(!hid('t.me/alijon_dev').includes('alijon'));
assert.ok(!hid('паспорт A1234567').includes('1234567'));
assert.ok(!hid('мой A1234567').includes('1234567'));
assert.ok(!hid('меня зовут Алиджон Рассулов').includes('Алиджон'));
assert.equal(hid('меня зовут Алиджон и я не понимаю цикл'), 'меня зовут [скрыто] и я не понимаю цикл');
assert.ok(!hid('мне 18 лет').includes('18'));
assert.ok(!hid('я родился 5 мая 2006').includes('2006'));
assert.ok(!hid('живу по адресу ул. Рудаки 10, кв 5').includes('Рудаки'));
assert.ok(!hid('https://api.site.tj/x?token=abc123secret&a=1').includes('abc123'));
assert.ok(!hid('ман 18 сола').includes('18'));
assert.ok(!hid('Номи ман Фаррух Каримов').includes('Фаррух'));

keep('const price = 1500000;');
keep('Как работает цикл for (let i = 0; i < 10; i++)?');
keep('```js\nconst price = 1500000;\nconst phone = 901234567; // no\n```'.replace('const phone = 901234567; // no\n', ''));
keep('`const total = 100 - 25 - 25`');
keep('@media (min-width: 600px) { a { color: red } }');
keep('Объясните цикл, у меня 3 задачи и 24 градуса');

// code fields
{
  const r = redactCodeField('const price = 1500000;\nconst n = 901234567;\nconsole.log(price)');
  assert.equal(r.hit, false);
  assert.ok(r.text.includes('1500000') && r.text.includes('901234567'));
  n++;
  const e = redactCodeField('const mail = "a.b@mail.ru"; const tel = "+992 90 123 45 67";');
  assert.ok(e.hit && !e.text.includes('mail.ru') && !e.text.includes('123 45'));
  n++;
}
// idempotent
assert.equal(redactMessage('меня зовут Алиджон Рассулов').text, redactMessage(redactMessage('меня зовут Алиджон Рассулов').text).text);

console.log(`${n} redact checks passed`);
