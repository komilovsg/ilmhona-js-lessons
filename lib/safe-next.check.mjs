// Self-check for the auth callback `next` validator. Run: `pnpm check:safe-next`.
import assert from 'node:assert/strict';
import { safeNext } from './safe-next.ts';

const O = 'https://ilmhona.example';
let n = 0;
const home = (raw) => {
  const u = safeNext(raw, O);
  assert.equal(u.href, O + '/', `expected fallback for ${JSON.stringify(raw)}, got ${u.href}`);
  n++;
};
const same = (raw, expectedPath) => {
  const u = safeNext(raw, O);
  assert.equal(u.origin, O, `left origin for ${JSON.stringify(raw)}: ${u.href}`);
  assert.ok(!u.pathname.startsWith('//'), `protocol-relative path for ${JSON.stringify(raw)}`);
  if (expectedPath !== undefined) assert.equal(u.pathname + u.search + u.hash, expectedPath);
  // Location header must stay on our origin even when a client re-resolves it.
  assert.equal(new URL(u.href).origin, O);
  n++;
};

// Rejected → "/"
for (const raw of [
  null, '', 'evil.com', 'https://evil.com', 'javascript:alert(1)', '//evil.com', '///evil.com',
  '/\\evil.com', '/\\/evil.com', '\\\\evil.com', '/\tevil.com', '/\n/evil.com', '\t//evil.com',
  '/..//evil.com', '/a/..//evil.com', '/%2e%2e//evil.com', '/./..//evil.com', '/a/b/../..//evil.com',
  '／／evil.com', '/ru\u0000x',
]) home(raw);

// Encoded forms stay literal paths on our origin (no decode happens after validation).
same('/%2F%2Fevil.com');
same('/%5Cevil.com');
same('/%09/evil.com');
same('/%2e%2e%2F%2Fevil.com');
same('/@evil.com', '/@evil.com');
same('/／evil.com');

// Valid
same('/ru/lessons/arrays?x=1', '/ru/lessons/arrays?x=1');
same('/ru/lessons/arrays?x=1&auth_error=1#t2', '/ru/lessons/arrays?x=1#t2');
same('/', '/');

// Result is a fresh object each call; cloning for fail() must not mutate it.
const a = safeNext('/ru?x=1', O);
const b = new URL(a);
b.searchParams.set('auth_error', '1');
assert.equal(a.search, '?x=1');
n++;

console.log(`ok - safe-next: ${n} checks passed`);
