// Copies the TypeScript compiler + the lib .d.ts files used by the in-browser type check into public/ts-lib/
// (self-hosted, loaded lazily only by pages with data-lang="ts" blocks). Output is gitignored.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const tsDir = path.dirname(createRequire(path.join(root, 'package.json')).resolve('typescript/package.json'));
const lib = path.join(tsDir, 'lib');
const out = path.join(root, 'public/ts-lib');
fs.mkdirSync(out, { recursive: true });

// closure of /// <reference lib="x" /> from the roots (must match options.lib in public/ts-lib/worker.js)
const libs = {};
const add = (name) => {
  if (libs[name]) return;
  libs[name] = fs.readFileSync(path.join(lib, name), 'utf8');
  for (const m of libs[name].matchAll(/\/\/\/\s*<reference\s+lib="([^"]+)"\s*\/>/g)) add(`lib.${m[1].toLowerCase()}.d.ts`);
};
['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'].forEach(add);

fs.copyFileSync(path.join(lib, 'typescript.js'), path.join(out, 'typescript.js'));
fs.writeFileSync(path.join(out, 'libs.json'), JSON.stringify(libs));
console.log(`ts-lib: typescript ${JSON.parse(fs.readFileSync(path.join(tsDir, 'package.json'), 'utf8')).version}, ${Object.keys(libs).length} libs`);
