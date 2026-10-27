import type { ReactNode } from 'react';

export type Lang = 'js' | 'jsx' | 'ts' | 'html' | 'css';

const KEYWORDS =
  'const|let|var|function|return|if|else|for|of|in|while|do|new|this|true|false|null|undefined|typeof|instanceof|class|break|continue|switch|case|default|try|catch|throw|async|await|delete';

const TOKENS = new RegExp(
  '(\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/)' + // 1 comment
    '|(`(?:\\\\.|[^`\\\\])*`|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\')' + // 2 string
    '|\\b(\\d+(?:\\.\\d+)?)\\b' + // 3 number
    '|\\b(' + KEYWORDS + ')\\b' + // 4 keyword
    '|(=>|\\.\\.\\.|===|!==|&&|\\|\\||\\?\\.|\\?\\?)' + // 5 operator
    '|\\b([A-Za-z_$][\\w$]*)(?=\\s*\\()', // 6 function call
  'gm',
);
const CLS = ['', 'com', 'str', 'num', 'key', 'op', 'fn'];

/** Tokenize JS source into plain strings and <span class="tok-*"> nodes. */
export function highlight(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of src.matchAll(TOKENS)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(src.slice(last, idx));
    const g = m.findIndex((v, i) => i > 0 && v !== undefined);
    out.push(
      <span key={idx} className={'tok-' + CLS[g]}>
        {m[0]}
      </span>,
    );
    last = idx + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

const span = (cls: string, text: string, key: number) => (
  <span key={key} className={'tok-' + cls}>
    {text}
  </span>
);

// HTML: tag names -> key, attribute names -> fn, values -> str, brackets -> op, comments -> com
const HTML_TAG = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/?[A-Za-z][^>]*>/gi;
const HTML_INNER = /("[^"]*"|'[^']*')|([A-Za-z_:][\w:.-]*)(?==)|(<\/?)([A-Za-z][\w-]*)|(\/?>)/g;

export function highlightHtml(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of src.matchAll(HTML_TAG)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(src.slice(last, idx));
    const tag = m[0];
    if (tag.startsWith('<!')) out.push(span('com', tag, idx));
    else {
      let l = 0;
      const parts: ReactNode[] = [];
      for (const t of tag.matchAll(HTML_INNER)) {
        const i = t.index ?? 0;
        if (i > l) parts.push(tag.slice(l, i));
        if (t[1]) parts.push(span('str', t[1], i));
        else if (t[2]) parts.push(span('fn', t[2], i));
        else if (t[3]) parts.push(span('op', t[3], i), span('key', t[4], i + t[3].length));
        else parts.push(span('op', t[5], i));
        l = i + t[0].length;
      }
      if (l < tag.length) parts.push(tag.slice(l));
      out.push(<span key={idx}>{parts}</span>);
    }
    last = idx + tag.length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

// CSS: comments, strings, numbers/colors, @rules, property names (inside braces)
const CSS_TOKENS =
  /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?\b)|(@[\w-]+)|([A-Za-z-]+)(?=\s*:)|([{}])/g;

export function highlightCss(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let depth = 0;
  for (const m of src.matchAll(CSS_TOKENS)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(src.slice(last, idx));
    last = idx + m[0].length;
    if (m[6]) {
      depth += m[6] === '{' ? 1 : -1;
      out.push(span('op', m[0], idx));
    } else if (m[5]) {
      out.push(depth > 0 ? span('fn', m[0], idx) : m[0]);
    } else {
      out.push(span(m[1] ? 'com' : m[2] ? 'str' : m[3] ? 'num' : 'key', m[0], idx));
    }
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

export function highlightLang(src: string, lang: Lang = 'js'): ReactNode[] {
  return lang === 'html' ? highlightHtml(src) : lang === 'css' ? highlightCss(src) : highlight(src);
}
