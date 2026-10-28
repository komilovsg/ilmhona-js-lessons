/* TypeScript check worker (classic worker, no bundler). Self-hosted: /ts-lib/typescript.js and /ts-lib/libs.json
 * are copied from node_modules/typescript by scripts/copy-ts-lib.mjs (prebuild/predev).
 * Also loadable from node (tests): `createChecker(ts, libs)` is exported via module.exports. */
'use strict';

var FILE = 'snippet.ts';

/** libs: { 'lib.es2022.d.ts': text, ... }. Returns { check(code) -> { diagnostics, js } }. */
function createChecker(ts, libs) {
  var options = {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    moduleDetection: ts.ModuleDetectionKind.Force, // every snippet is a module: top-level await, no clashes with DOM globals
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    types: [],
    noEmit: true,
    skipLibCheck: true,
  };
  var libFiles = {}; // parsed lib SourceFiles, kept across runs
  var prev; // previous program (reused: libs are not re-bound)
  function lib(name) {
    if (!(name in libs)) return undefined;
    return libFiles[name] || (libFiles[name] = ts.createSourceFile(name, libs[name], ts.ScriptTarget.ES2022));
  }
  function check(code) {
    // force module (= moduleDetection: force): createSourceFile does not read the compiler options
    var snippet = ts.createSourceFile(FILE, code, {
      languageVersion: ts.ScriptTarget.ES2022,
      setExternalModuleIndicator: function (f) { f.externalModuleIndicator = true; },
    }, true);
    var host = {
      getSourceFile: function (f) { return f === FILE ? snippet : lib(f.replace(/^.*\//, '')); },
      getDefaultLibFileName: function () { return 'lib.es2022.d.ts'; },
      getDefaultLibLocation: function () { return ''; },
      writeFile: function () {},
      getCurrentDirectory: function () { return ''; },
      getCanonicalFileName: function (f) { return f; },
      useCaseSensitiveFileNames: function () { return true; },
      getNewLine: function () { return '\n'; },
      fileExists: function (f) { return f === FILE || f.replace(/^.*\//, '') in libs; },
      readFile: function (f) { return f === FILE ? code : libs[f.replace(/^.*\//, '')]; },
      directoryExists: function () { return true; },
      getDirectories: function () { return []; },
    };
    prev = ts.createProgram([FILE], options, host, prev);
    var diags = ts.getPreEmitDiagnostics(prev, snippet);
    var diagnostics = diags
      .filter(function (d) { return d.file && d.file.fileName === FILE && d.category === ts.DiagnosticCategory.Error; })
      .map(function (d) {
        var start = d.start || 0;
        var lc = snippet.getLineAndCharacterOfPosition(start);
        return {
          line: lc.line + 1,
          col: lc.character + 1,
          start: start,
          length: d.length || 0,
          code: d.code,
          message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
        };
      });
    var js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: false }).outputText;
    return { diagnostics: diagnostics, js: js };
  }
  return { check: check };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { createChecker: createChecker };

if (typeof importScripts === 'function') {
  var checker;
  var ready = (function () {
    var libsP = fetch('/ts-lib/libs.json').then(function (r) {
      if (!r.ok) throw new Error('libs.json ' + r.status);
      return r.json();
    });
    importScripts('/ts-lib/typescript.js');
    return libsP.then(function (libs) {
      checker = createChecker(self.ts, libs);
      postMessage({ ready: true });
    });
  })();
  ready.catch(function (e) { postMessage({ ready: false, error: String((e && e.message) || e) }); });
  self.onmessage = function (e) {
    var m = e.data;
    ready.then(function () {
      try {
        var r = checker.check(m.code);
        postMessage({ id: m.id, diagnostics: r.diagnostics, js: r.js });
      } catch (err) {
        postMessage({ id: m.id, error: String((err && err.message) || err) });
      }
    }, function () {});
  };
}
