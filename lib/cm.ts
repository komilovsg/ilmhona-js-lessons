/**
 * CodeMirror 6 setup. Imported ONLY via dynamic import() from components/CodeEditor.tsx
 * (on first interaction with an editable block), so none of this is in the initial lesson bundle.
 */
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type CompletionContext, type Completion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { bracketMatching, HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { EditorState, Prec } from '@codemirror/state';
import { drawSelection, EditorView, keymap } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import type { Messages } from '../messages/ru';
import type { Lang } from './highlight';

/** Dictionary section for the editor (`t.cm`). */
export type CmStrings = Messages['cm'];

// ---- theme: same colors/metrics as the static <pre class="code"> (see globals.css) ----
const theme = EditorView.theme(
  {
    '&': { color: 'var(--code-ink)', backgroundColor: 'transparent', fontSize: 'inherit' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'inherit', lineHeight: 'inherit', overflow: 'auto' },
    '.cm-content': { padding: '0', caretColor: 'var(--code-ink)', fontFamily: 'inherit' },
    '.cm-line': { padding: '0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--code-ink)', borderLeftWidth: '2px' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(130, 170, 255, .28)',
    },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: 'rgba(137, 221, 255, .18)', outline: 'none' },
    '.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': { backgroundColor: 'rgba(255, 138, 155, .25)' },
    '.cm-tooltip': {
      border: '1px solid var(--code-line)',
      backgroundColor: '#121722',
      color: 'var(--code-ink)',
      borderRadius: '8px',
      overflow: 'hidden',
      fontFamily: 'var(--mono)',
      fontSize: '13px',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--mono)', maxHeight: '14em' },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent)', color: '#fff' },
    '.cm-completionDetail': { color: 'var(--c-com)', fontStyle: 'normal' },
    '.cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail': { color: 'rgba(255,255,255,.8)' },
  },
  { dark: true },
);

const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword, t.self, t.null, t.atom, t.bool, t.tagName], color: 'var(--c-key)' },
  { tag: [t.string, t.special(t.string), t.regexp, t.attributeValue], color: 'var(--c-str)' },
  { tag: [t.number, t.unit, t.color, t.attributeName], color: 'var(--c-num)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--c-com)', fontStyle: 'italic' },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName)), t.definition(t.function(t.propertyName))],
    color: 'var(--c-fn)',
  },
  { tag: [t.compareOperator, t.logicOperator, t.angleBracket], color: 'var(--c-op)' },
]);

// ---- autocomplete (JS/JSX): keywords, globals, members of well-known objects, words from the document ----
const KEYWORDS = 'const let var function return if else for of in while do new this true false null undefined typeof instanceof class break continue switch case default try catch throw async await delete import export from extends'.split(' ');

const MEMBERS: Record<string, string[]> = {
  console: ['log', 'warn', 'error', 'info', 'table', 'debug'],
  document: ['querySelector', 'querySelectorAll', 'getElementById', 'createElement', 'body', 'addEventListener', 'createTextNode'],
  JSON: ['parse', 'stringify'],
  Math: ['round', 'floor', 'ceil', 'max', 'min', 'random', 'abs', 'sqrt', 'pow', 'PI', 'trunc'],
  Object: ['keys', 'values', 'entries', 'assign', 'freeze', 'fromEntries'],
  Array: ['isArray', 'from', 'of'],
  Number: ['isInteger', 'parseFloat', 'parseInt', 'isNaN', 'MAX_SAFE_INTEGER'],
  Promise: ['all', 'allSettled', 'race', 'resolve', 'reject', 'any'],
  localStorage: ['getItem', 'setItem', 'removeItem', 'clear'],
  sessionStorage: ['getItem', 'setItem', 'removeItem', 'clear'],
  window: ['addEventListener', 'setTimeout', 'fetch', 'localStorage', 'innerWidth', 'innerHeight'],
};
const GLOBALS = ['console', 'document', 'window', 'JSON', 'Math', 'Object', 'Array', 'Number', 'String', 'Promise', 'Date', 'Map', 'Set', 'localStorage', 'sessionStorage', 'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'parseInt', 'parseFloat', 'isNaN', 'alert', 'Error'];
const ARRAY_METHODS = ['map', 'filter', 'reduce', 'find', 'findIndex', 'forEach', 'some', 'every', 'includes', 'indexOf', 'sort', 'slice', 'splice', 'push', 'pop', 'shift', 'unshift', 'join', 'concat', 'flat', 'flatMap', 'reverse', 'length', 'at'];
const STRING_METHODS = ['toUpperCase', 'toLowerCase', 'trim', 'split', 'replace', 'replaceAll', 'startsWith', 'endsWith', 'padStart', 'padEnd', 'repeat', 'charAt', 'substring'];
const ELEMENT_METHODS = ['addEventListener', 'removeEventListener', 'classList', 'textContent', 'innerHTML', 'append', 'remove', 'setAttribute', 'getAttribute', 'style', 'value', 'querySelector', 'querySelectorAll', 'appendChild', 'children'];
const PROMISE_METHODS = ['then', 'catch', 'finally'];
const RESPONSE_METHODS = ['json', 'text', 'ok', 'status'];

const mk = (labels: string[], type: string, detail?: string): Completion[] => labels.map((label) => ({ label, type, detail }));

const genericMembers = (s: CmStrings) => [
  ...mk(ARRAY_METHODS, 'method', s.array),
  ...mk(STRING_METHODS, 'method', s.string),
  ...mk(ELEMENT_METHODS, 'property', s.element),
  ...mk(PROMISE_METHODS, 'method', s.promise),
  ...mk(RESPONSE_METHODS, 'method', s.response),
];

const jsSource = (s: CmStrings) => (ctx: CompletionContext) => {
  const word = ctx.matchBefore(/[\w$]*(\.[\w$]*)?$/);
  if (!word || (word.from === word.to && !ctx.explicit)) return null;
  const text = word.text;
  const dot = text.lastIndexOf('.');
  if (dot >= 0) {
    // member access: `console.l`, `arr.fi`
    const obj = text.slice(0, dot);
    const options = MEMBERS[obj] ? mk(MEMBERS[obj], 'method') : genericMembers(s);
    return { from: word.from + dot + 1, options, validFor: /^[\w$]*$/ };
  }
  if (text.length < 2 && !ctx.explicit) return null;
  const seen = new Set<string>([...KEYWORDS, ...GLOBALS]);
  const own: Completion[] = [];
  for (const m of ctx.state.doc.toString().matchAll(/[A-Za-z_$][\w$]{2,}/g)) {
    if (m.index === word.from) continue; // the word being typed
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      own.push({ label: m[0], type: 'variable' });
    }
  }
  return {
    from: word.from,
    options: [...mk(KEYWORDS, 'keyword'), ...mk(GLOBALS, 'variable'), ...own],
    validFor: /^[\w$]*$/,
  };
};

export type MountOptions = {
  parent: HTMLElement;
  strings: CmStrings;
  doc: string;
  lang: Lang;
  onRun: (value: string) => void;
  onBlur: (value: string) => void;
  onFocus?: () => void;
};

export type MountedEditor = {
  view: EditorView;
  getValue: () => string;
  setValue: (v: string) => void;
  focus: () => void;
  /** Next Tab moves focus out instead of indenting (used when focus arrived via keyboard). */
  release: () => void;
  destroy: () => void;
};

export function mountEditor(o: MountOptions): MountedEditor {
  // Accessibility: Tab indents, so Esc then Tab must leave the editor.
  let released = false;
  const tabHandling = EditorView.domEventHandlers({
    keydown(e) {
      if (e.key === 'Escape') released = true;
      else if (e.key !== 'Tab' && e.key !== 'Shift') released = false;
      return false;
    },
    blur() {
      released = false;
      return false;
    },
  });

  const lang = o.lang === 'html' ? html() : o.lang === 'css' ? css() : javascript({ jsx: o.lang === 'jsx' });

  const view = new EditorView({
    parent: o.parent,
    state: EditorState.create({
      doc: o.doc,
      extensions: [
        history(),
        drawSelection(),
        bracketMatching(),
        closeBrackets(),
        EditorState.tabSize.of(2),
        indentUnit.of('  '),
        lang,
        o.lang === 'js' || o.lang === 'jsx' ? autocompletion({ override: [jsSource(o.strings)], activateOnTyping: true }) : autocompletion(),
        syntaxHighlighting(highlightStyle),
        theme,
        tabHandling,
        EditorView.contentAttributes.of({
          'aria-label': o.strings.label,
          'aria-description': o.strings.description,
          spellcheck: 'false',
          autocapitalize: 'off',
          autocorrect: 'off',
          title: o.strings.description,
        }),
        Prec.highest(
          keymap.of([
            {
              // Cmd+Enter / Ctrl+Enter (Mod = Cmd on macOS; Ctrl is accepted there too, as in the old editor)
              key: 'Mod-Enter',
              preventDefault: true,
              run: (v) => (o.onRun(v.state.doc.toString()), true),
            },
            {
              key: 'Ctrl-Enter',
              preventDefault: true,
              run: (v) => (o.onRun(v.state.doc.toString()), true),
            },
            {
              key: 'Tab',
              run: (v) => {
                if (released) {
                  released = false;
                  return false; // let the browser move focus
                }
                if (v.state.selection.ranges.every((r) => r.empty)) {
                  v.dispatch(v.state.replaceSelection('  '), { scrollIntoView: true, userEvent: 'input' });
                  return true;
                }
                return indentMore(v);
              },
            },
            { key: 'Shift-Tab', run: (v) => (released ? false : indentLess(v)) },
          ]),
        ),
        keymap.of([...closeBracketsKeymap, ...completionKeymap, ...defaultKeymap, ...historyKeymap]),
        EditorView.domEventHandlers({
          focus: () => (o.onFocus?.(), false),
          blur: (_e, v) => (o.onBlur(v.state.doc.toString()), false),
        }),
      ],
    }),
  });

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue: (v) => {
      if (view.state.doc.toString() !== v) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
    },
    focus: () => view.focus(),
    release: () => {
      released = true;
    },
    destroy: () => view.destroy(),
  };
}
