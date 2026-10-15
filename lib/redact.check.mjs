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
// ---- audit M1: names, ages, phones, emails, Telegram, addresses ----
const gone = (s, ...secrets) => {
  const out = hid(s);
  for (const x of secrets) assert.ok(!out.includes(x), `leaked "${x}": ${s} -> ${out}`);
};
gone('меня зовут фаридун', 'фаридун');
gone('Меня зовут Фаридун Каримов', 'Фаридун', 'Каримов');
gone('Моё имя: Фаридун', 'Фаридун');
gone('МОЁ ИМЯ Фаридун', 'Фаридун');
gone('Я Фаридун Каримов, мне 15 лет', 'Фаридун', 'Каримов', '15');
gone('Привет! Я Фаридун Каримов', 'Фаридун');
gone('ман Фаридун ҳастам', 'Фаридун');
gone('Номам Фаридун', 'Фаридун');
gone('Номи ман Фаридун аст', 'Фаридун');
gone('мне пятнадцать лет', 'пятнадцать');
gone('Мне двадцать один год', 'двадцать');
gone('ман 15-сола', '15');
gone('Ман 15 сола', '15');
gone('ман 19 сол дорам', '19');
gone('звоните 89271234567', '1234567');
gone('8 (927) 123-45-67', '123');
gone('тел 93.123.45.67', '123');
gone('тел 9 3 1 2 3 4 5 6 7', '4 5 6');
gone('мой номер 93 123 45 67', '123');
gone('пишите 93 123 45 67', '123');
gone('рақам: 55 123 4567', '4567');
gone('почта ali(at)mail.ru', 'ali', 'mail');
gone('ali @ mail.ru', 'ali', 'mail');
gone('ali＠mail.ru', 'ali', 'mail');
gone('ali [at] mail [dot] ru', 'ali', 'mail');
gone('почта ali собака mail точка ru', 'ali', 'mail');
gone('тг: farid_k', 'farid');
gone('мой телеграм @farid_k', 'farid', '@');
gone('telegram farid_2008', 'farid');
gone('я живу в Душанбе на улице Рудаки 45', 'Рудаки', 'Душанбе');
gone('адрес школы ул. Рудаки 45, рядом парк', 'Рудаки');
gone('кӯчаи Рудакӣ 45', 'Рудакӣ');
gone('Живу по адресу Душанбе, ул. Рудаки 45, кв 12', 'Рудаки');
keep('дата 2024-10-16 12:30');
keep('числа 100 200 300 400');
keep('Math.max(123 456 789)');
keep('Math.max(923 456 789)');
keep('IP 192.168.1.1 и порт 3000');
keep('цена 1 500 000 сомони');
keep('arr = [1, 2, 3, 4, 5, 6, 7, 8]');
keep('telegram bot на JS');
keep('Меня зовут на урок в 10');
keep('я живу'); // no place given
keep('Мне нужно понять цикл');
// idempotent on the new rules too
for (const s of ['Живу по адресу Душанбе, ул. Рудаки 45', 'я живу в Душанбе', 'тг: farid_k', 'меня зовут фаридун'])
  assert.equal(redactMessage(redactMessage(s).text).hit, false, `idempotent: ${s}`);
// code fields: keys / variables with personal values, phone-shaped string literals
{
  const c = (src, ...secrets) => {
    const r = redactCodeField(src);
    assert.ok(r.hit, `code should redact: ${src}`);
    for (const x of secrets) assert.ok(!r.text.includes(x), `code leaked "${x}": ${r.text}`);
    n++;
  };
  c('const name = "Фаридун";', 'Фаридун');
  c("const user = { fullName: 'Фаридун Каримов', age: 15, city: 'Душанбе' };", 'Фаридун', '15', 'Душанбе');
  c('let phone = "931234567";', '931234567');
  c('{"email": "x@y.tj", "tel": "93 123 45 67"}', 'x@y', '45 67');
  c('const адрес = `Рудаки 45`;', 'Рудаки');
  c('const contact = "93-123-45-67";', '45-67');
  const k = (src) => {
    const r = redactCodeField(src);
    assert.equal(r.text, src, `code should keep: ${src} -> ${r.text}`);
    n++;
  };
  k('if (name === "Ali") console.log(age > 18);');
  k('const total = 100 + 200; const id = "abc-123-xyz";');
  k('const nums = "100 200 300";');
  k('el.name; user.age++;');
}
// idempotent
assert.equal(redactMessage('меня зовут Алиджон Рассулов').text, redactMessage(redactMessage('меня зовут Алиджон Рассулов').text).text);

console.log(`${n} redact checks passed`);
