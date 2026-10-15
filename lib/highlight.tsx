import type { ReactNode } from 'react';

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
