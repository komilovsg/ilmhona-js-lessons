import type { Messages } from '../messages/ru';

/** Dictionary section with the error hints (`t.explain`). */
export type ExplainStrings = Messages['explain'];

/** Human-readable hints for common runtime errors, in the language of `s` (shown to students). */
export function explain(rawMsg: string, s: ExplainStrings): string {
  const msg = String(rawMsg).slice(0, 300); // bound regex work (ReDoS)
  let m: RegExpMatchArray | null;
  if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(msg)) return s.network;
  if ((m = msg.match(/([\w$.\[\]'"]{1,80}) is not defined/))) return s.notDefined(m[1]);
  if ((m = msg.match(/access '([\w$]{1,80})' before initialization|access lexical declaration '([\w$]{1,80})'/))) return s.beforeInit(m[1] || m[2]);
  if ((m = msg.match(/([\w$.\[\]'"]{1,80}) is not a function/))) return s.notFunction(m[1]);
  if (/Cannot read propert|is undefined|is null/.test(msg)) return s.nullProp;
  if (/Assignment to constant|invalid assignment to const/.test(msg)) return s.constAssign;
  if (/has already been declared|redeclaration/.test(msg)) return s.redeclared;
  if (/JSON/.test(msg)) return s.json;
  if (/SyntaxError|Unexpected|missing/.test(msg)) return s.syntax;
  return '';
}
