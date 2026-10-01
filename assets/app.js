// Ilmhona · Frontend + ИИ — подсветка кода, запуск примеров, прогресс задач
(() => {
  const KEYWORDS = 'const|let|var|function|return|if|else|for|of|in|while|do|new|this|true|false|null|undefined|typeof|instanceof|class|break|continue|switch|case|default|try|catch|throw|async|await|delete';
  const TOKENS = new RegExp(
    '(\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/)' +                                         // 1 комментарий
    '|(`(?:\\\\.|[^`\\\\])*`|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\')' + // 2 строка
    '|\\b(\\d+(?:\\.\\d+)?)\\b' +                                                   // 3 число
    '|\\b(' + KEYWORDS + ')\\b' +                                                   // 4 ключевое слово
    '|(=>|\\.\\.\\.|===|!==|&&|\\|\\||\\?\\.|\\?\\?)' +                             // 5 оператор
    '|\\b([A-Za-z_$][\\w$]*)(?=\\s*\\()',                                           // 6 вызов функции
    'gm'
  );
  const CLS = [null, 'com', 'str', 'num', 'key', 'op', 'fn'];

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // Подсветка: строим узлы DOM, а не HTML-строку
  function highlight(src) {
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of src.matchAll(TOKENS)) {
      if (m.index > last) frag.append(src.slice(last, m.index));
      const g = m.findIndex((v, i) => i > 0 && v !== undefined);
      frag.append(el('span', 'tok-' + CLS[g], m[0]));
      last = m.index + m[0].length;
    }
    if (last < src.length) frag.append(src.slice(last));
    return frag;
  }

  // ---------- вывод значений, как в консоли браузера (выполняется внутри iframe) ----------
  function fmt(v, depth = 0, seen = new Set()) {
    const IDENT = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;
    if (typeof v === 'string') return depth ? `"${v}"` : v;
    if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
    if (typeof v === 'function') return `ƒ ${v.name || 'anonymous'}()`;
    if (v === null || typeof v !== 'object') return String(v);
    if (v instanceof Error) return `${v.name}: ${v.message}`;
    if (seen.has(v)) return '[Circular]';
    if (depth > 4) return Array.isArray(v) ? '[…]' : '{…}';
    seen.add(v);
    const isArr = Array.isArray(v);
    const parts = isArr
      ? Array.from(v, x => fmt(x, depth + 1, seen))
      : Object.keys(v).map(k => `${IDENT.test(k) ? k : `"${k}"`}: ${fmt(v[k], depth + 1, seen)}`);
    seen.delete(v);
    if (!parts.length) return isArr ? '[]' : '{}';
    const flat = isArr ? `[${parts.join(', ')}]` : `{ ${parts.join(', ')} }`;
    if (flat.length <= 72 && !flat.includes('\n')) return flat;
    const pad = '  '.repeat(depth + 1);
    return `${isArr ? '[' : '{'}\n${parts.map(p => pad + p).join(',\n')}\n${'  '.repeat(depth)}${isArr ? ']' : '}'}`;
  }

  // ---------- подсказки к частым ошибкам ----------
  function explain(msg) {
    let m;
    if ((m = msg.match(/(\S+) is not defined/))) return `Переменная «${m[1]}» не найдена: её не объявили или она не видна в этом месте (область видимости).`;
    if ((m = msg.match(/access '(\S+)' before initialization|access lexical declaration '(\S+)'/))) return `К «${m[1] || m[2]}» обратились раньше, чем она объявлена через let/const. Перенесите вызов ниже объявления.`;
    if ((m = msg.match(/(\S+) is not a function/))) return `«${m[1]}» — не функция. Проверьте имя, скобки и порядок объявления.`;
    if (/Cannot read propert|is undefined|is null/.test(msg)) return 'Пытаемся взять свойство у undefined или null. Проверьте, что объект или элемент действительно существует.';
    if (/Assignment to constant|invalid assignment to const/.test(msg)) return 'Нельзя переприсвоить const. Используйте let, если значение должно меняться.';
    if (/has already been declared|redeclaration/.test(msg)) return 'Эта переменная уже объявлена выше. Дайте другое имя или уберите повторный let/const.';
    if (/JSON/.test(msg)) return 'Строка не похожа на правильный JSON: ключи и строки — только в двойных кавычках, без лишних запятых.';
    if (/SyntaxError|Unexpected|missing/.test(msg)) return 'Синтаксическая ошибка: проверьте скобки (), {}, [] и кавычки.';
    return '';
  }

  // ---------- запуск кода студента в изолированном iframe (sandbox) ----------
  const runs = new Map();
  addEventListener('message', e => {
    const d = e.data;
    const r = d && runs.get(d.ilmRun);
    if (!r || e.source !== r.frame.contentWindow) return;
    if (d.kind === 'done') {
      if (!r.out.querySelector('.line')) r.line('(ничего не выведено — добавьте console.log)', 'empty');
      r.frame.remove();
      runs.delete(d.ilmRun);
    } else if (d.kind === 'err') {
      const msg = String(d.text).replace(/^Uncaught\s+/, '');
      r.line('✖ ' + msg, 'err');
      const hint = explain(msg);
      if (hint) r.line('↳ ' + hint, 'warn-line');
    } else {
      r.line(d.text, d.kind === 'warn' ? 'warn-line' : d.kind === 'error' ? 'err' : '');
    }
  });

  let runSeq = 0;
  function run(code, out) {
    out.replaceChildren();
    out.classList.add('show');
    const id = 'r' + (++runSeq);
    const line = (text, cls) => out.append(el('div', 'line' + (cls ? ' ' + cls : ''), text));
    const frame = el('iframe');
    frame.sandbox = 'allow-scripts';
    frame.hidden = true;
    const safe = s => s.replace(/<\/script/gi, '<\\/script');
    const boot = `
      const ID = ${JSON.stringify(id)};
      ${fmt.toString()}
      const send = (kind, text) => parent.postMessage({ ilmRun: ID, kind, text }, '*');
      for (const k of ['log', 'info', 'debug', 'table', 'warn', 'error'])
        console[k] = (...a) => send(k, a.map(x => fmt(x)).join(' '));
      addEventListener('error', e => send('err', e.error && e.error.name ? e.error.name + ': ' + e.error.message : e.message));`;
    frame.srcdoc =
      `<script>${safe(boot)}<\/script>` +
      // type="module": своя область (const top / name не конфликтуют с window), строгий режим, порядок сохраняется
      `<script type="module">\n${safe(code)}\n<\/script>` +
      `<script type="module">parent.postMessage({ ilmRun: ${JSON.stringify(id)}, kind: 'done' }, '*')<\/script>`;
    runs.set(id, { frame, out, line });
    document.body.append(frame);
  }

  // ---------- блоки кода ----------
  function setupCode(pre) {
    const original = pre.textContent.replace(/^\n/, '').replace(/\s+$/, '');
    pre.replaceChildren(highlight(original));

    const wrap = el('div', 'code-wrap');
    pre.before(wrap);
    const head = el('div', 'code-head');
    const dots = el('span', 'dots');
    dots.append(el('i'), el('i'), el('i'));
    head.append(dots);
    wrap.append(head, pre);

    if (!pre.hasAttribute('data-run')) {
      head.append(el('span', 'hint-edit', pre.dataset.title || 'JavaScript'));
      return;
    }

    const resetBtn = el('button', 'reset', '↺ Сброс');
    const runBtn = el('button', 'run', '▶ Запустить');
    resetBtn.type = runBtn.type = 'button';
    resetBtn.title = 'Вернуть исходный код';
    head.append(el('span', 'hint-edit', (pre.dataset.title || 'Можно редактировать') + ' · Ctrl + Enter'), resetBtn, runBtn);
    const out = el('div', 'output');
    wrap.append(out);

    pre.contentEditable = 'plaintext-only';
    if (pre.contentEditable !== 'plaintext-only') pre.contentEditable = 'true';
    pre.spellcheck = false;

    const text = () => pre.innerText.replace(/ /g, ' ');
    const doRun = () => run(text(), out);
    runBtn.addEventListener('click', doRun);
    resetBtn.addEventListener('click', () => {
      pre.replaceChildren(highlight(original));
      out.classList.remove('show');
    });
    pre.addEventListener('blur', () => pre.replaceChildren(highlight(text())));
    pre.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doRun(); }
      else if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
    });
  }

  // ---------- прогресс задач ----------
  const page = location.pathname.split('/').pop() || 'index';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v ? localStorage.setItem(k, '1') : localStorage.removeItem(k); } catch {} },
  };
  function setupTasks() {
    const tasks = [...document.querySelectorAll('.task')];
    const solvedEl = document.querySelector('[data-solved]');
    const totalEl = document.querySelector('[data-total]');
    const bar = document.querySelector('.progress-bar i');
    const update = () => {
      const n = tasks.filter(t => t.classList.contains('done')).length;
      if (solvedEl) solvedEl.textContent = n;
      if (totalEl) totalEl.textContent = tasks.length;
      if (bar) bar.style.width = (tasks.length ? n / tasks.length * 100 : 0) + '%';
      document.querySelectorAll('.toc a').forEach(a => {
        const sec = document.getElementById(a.hash.slice(1));
        const ts = sec ? [...sec.querySelectorAll('.task')] : [];
        const c = a.querySelector('.toc-count');
        if (c && ts.length) c.textContent = ` · ${ts.filter(t => t.classList.contains('done')).length}/${ts.length}`;
      });
    };
    tasks.forEach((t, i) => {
      const key = `ilmhona:${page}:${t.id || i}`;
      const btn = el('button', 'done-toggle');
      btn.type = 'button';
      const paint = () => { btn.textContent = t.classList.contains('done') ? '✓ Решено' : '○ Отметить как решённую'; };
      if (store.get(key)) t.classList.add('done');
      paint();
      btn.addEventListener('click', () => {
        t.classList.toggle('done');
        store.set(key, t.classList.contains('done'));
        paint();
        update();
      });
      t.append(btn);
    });
    return update;
  }

  // ---------- оглавление ----------
  function setupToc() {
    const toc = document.querySelector('.toc');
    if (!toc) return;
    const heads = [...document.querySelectorAll('main section[id] > h2')];
    const list = el('ol');
    const links = new Map();
    heads.forEach(h => {
      const id = h.parentElement.id;
      const a = el('a', null, h.dataset.toc || h.textContent.replace(/^\s*\d+\s*/, '').trim());
      a.href = '#' + id;
      a.append(el('span', 'toc-count'));
      const li = el('li');
      li.append(a);
      list.append(li);
      links.set(id, a);
    });
    toc.replaceChildren(el('p', null, 'Содержание'), list);
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(a => a.classList.remove('active'));
        links.get(en.target.id)?.classList.add('active');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    heads.forEach(h => io.observe(h.parentElement));
  }

  // ---------- кнопки «копировать» у промптов ----------
  function setupPrompts() {
    document.querySelectorAll('.prompt').forEach(p => {
      const text = p.textContent.trim();
      const b = el('button', 'copy', 'Копировать');
      b.type = 'button';
      b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(text); b.textContent = 'Скопировано ✓'; }
        catch { b.textContent = 'Выделите и скопируйте'; }
        setTimeout(() => (b.textContent = 'Копировать'), 1800);
      });
      p.append(b);
    });
  }

  document.querySelectorAll('pre.code').forEach(setupCode);
  setupToc();
  const update = setupTasks();
  setupPrompts();
  update();
})();
