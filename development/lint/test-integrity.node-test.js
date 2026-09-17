const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { analyzeFile, collectTestFiles } = require('./test-integrity');

// analyzeFile only parses the text it is handed, but it resolves `__dirname`
// relative reads by shape rather than by opening them, so any path inside the
// repository works as the notional location of the fixture.
const FIXTURE_PATH = path.join(__dirname, 'fixture.test.ts');

function gatedRules(source) {
  return analyzeFile(FIXTURE_PATH, source)
    .violations.filter(
      (violation) =>
        violation.rule === 'source-text-assertion' ||
        violation.rule === 'source-slice-eval',
    )
    .map((violation) => violation.rule);
}

function assertGated(source, message) {
  assert.ok(gatedRules(source).length > 0, message);
}

function assertClean(source, message) {
  assert.deepEqual(gatedRules(source), [], message);
}

test('catches a direct source-text assertion', () => {
  assertGated(`
    const source = readFileSync(join(__dirname, 'Thing.tsx'), 'utf8');
    it('x', () => {
      expect(source).toContain('testID="thing"');
    });
  `);
});

test('catches offset ordering stored in bindings', () => {
  // The three-statement form of expect(s.indexOf(a)).toBeLessThan(s.indexOf(b)).
  assertGated(`
    const source = readFileSync(join(__dirname, 'thing.js'), 'utf8');
    const body = source.slice(source.indexOf('function go('));
    it('x', () => {
      const first = body.indexOf('a(');
      const second = body.indexOf('b(');
      expect(second).toBeGreaterThan(first);
    });
  `);
});

test('catches a read that is not the immediate initializer', () => {
  assertGated(
    `
    it('x', async () => {
      const source = await readFile(join(__dirname, 'thing.ts'), 'utf8');
      expect(source).toMatch(/go/u);
    });
  `,
    'await',
  );
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts')).toString();
    it('x', () => {
      expect(source).toContain('go');
    });
  `,
    'toString',
  );
  assertGated(
    `
    it('x', () => {
      expect(readFileSync(join(__dirname, 'thing.ts'), 'utf8')).toContain('go');
    });
  `,
    'inline, no binding',
  );
});

test('catches taint through an optional chain', () => {
  assertGated(`
    const source = readFileSync(resolve(__dirname, '../thing.ts'), 'utf-8');
    const method = source.match(/async go\\(\\) \\{[\\s\\S]*?\\n\\}/u)?.[0];
    it('x', () => {
      expect(method).not.toMatch(/setTimeout/u);
    });
  `);
});

test('catches a fragment sliced out of source and evaluated', () => {
  assertGated(`
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    const fragment = source.slice(source.indexOf('const go ='));
    const module = {};
    runInNewContext(transformSync(fragment).code, { module });
    it('x', () => {
      expect(module.exports.go()).toBe(1);
    });
  `);
});

test('catches node:assert sinks, not lookalike methods', () => {
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    test('x', () => { assert.equal(source, 'go'); });
  `,
    'assert.equal',
  );
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    test('x', () => { assert.ok(source.includes('go')); });
  `,
    'assert.ok',
  );
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    test('x', () => { assert.strict.deepEqual(source.split('\\n'), []); });
  `,
    'assert.strict.deepEqual',
  );
  assertClean(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    test('x', () => { chai.expect(source).to.equal('go'); });
  `,
    'a .equal that is not node:assert',
  );
});

test('an assertion counts however the assertion function is reached', () => {
  const tainted = `const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');`;
  const inTest = (preamble, call) =>
    `${preamble}\n${tainted}\ntest('x', (t) => { ${call}; });`;
  for (const [shape, preamble, call] of [
    [
      'assert()',
      "const assert = require('node:assert');",
      "assert(source.includes('go'))",
    ],
    [
      'assert.strict()',
      "import assert from 'assert';",
      "assert.strict(source.includes('go'))",
    ],
    ['assert() without an import', '', "assert(source.includes('go'))"],
    ['a test context', '', "t.assert.ok(source.includes('go'))"],
    [
      'a named import',
      "import { match } from 'node:assert/strict';",
      'match(source, /go/u)',
    ],
    [
      'a renamed import',
      "import { ok as check } from 'node:assert';",
      "check(source.includes('go'))",
    ],
    [
      'a destructured require',
      "const { equal } = require('node:assert');",
      "equal(source, 'go')",
    ],
    [
      'a renamed expect',
      "import { expect as check } from '@jest/globals';",
      "check(source).toContain('go')",
    ],
  ]) {
    assertGated(inTest(preamble, call), shape);
  }
  // Controls: the same call on plain text, and a function that only shares a
  // name with an assertion.
  assertClean(
    inTest(
      "const assert = require('node:assert');",
      "assert('plain'.includes('go'))",
    ),
    'control: assert() on plain text',
  );
  assertClean(
    inTest("import { match } from './matchers';", 'match(source, /go/u)'),
    'control: a match() from elsewhere',
  );
});

test('catches a variable filename inside a named source directory', () => {
  assertGated(
    `
    const repoRoot = path.resolve(__dirname, '../../../..');
    const source = readFileSync(path.join(repoRoot, 'packages/kit/src/views', name), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'named source directory',
  );
  assertClean(
    `
    const repoRoot = path.resolve(__dirname, '../../../..');
    const workflow = readFileSync(path.join(repoRoot, '.github/workflows', name), 'utf8');
    it('x', () => { expect(workflow).toContain('go'); });
  `,
    'a directory that holds no source',
  );
});

test('separates evaluating a whole file from evaluating a fragment', () => {
  // A .ts read so the target really is classified as source: the point under
  // test is whole-versus-fragment, not the classification.
  assertClean(
    `
    it('x', () => {
      const go = runInNewContext(
        \`(\${readFileSync(join(__dirname, 'thing.ts'), 'utf8')})\`,
      );
      expect(go(1)).toBe('one');
    });
  `,
    'whole file',
  );
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    const fragment = source.slice(source.indexOf('const go ='));
    runInNewContext(fragment, {});
    it('x', () => { expect(1).toBe(1); });
  `,
    'sliced fragment',
  );
  // Cutting with two regex replaces instead of slice is the same thing.
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    const fragment = source
      .replace(/.*?(?=const go =)/su, '')
      .replace(/const done.*$/su, '');
    runInNewContext(transformSync(fragment).code, {});
    it('x', () => { expect(1).toBe(1); });
  `,
    'regex-replace fragment',
  );
});

test('string concatenation carries source text like a template does', () => {
  assertGated(`
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => {
      expect('// ' + source).toContain('go');
    });
  `);
});

test('only a path ending in a variable falls back to the directory name', () => {
  // The directory says "source" but the filename is not written down, so the
  // directory is all there is to go on.
  assertGated(
    `
    ${REPO_ROOT_PREAMBLE}
    const source = readFileSync(path.join(repoRoot, 'packages/kit/src', name), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'ends in a variable',
  );
  // A path that ends in a literal already said what it is, whatever the
  // directory is called. `.text-js` is a shipped artifact, not source.
  assertClean(
    `
    ${REPO_ROOT_PREAMBLE}
    const source = readFileSync(path.join(repoRoot, 'packages/kit/src', 'thing.text-js'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'ends in a data literal',
  );
  // Control: the same shape with a source extension is still gated, so the
  // clean result above comes from the extension and not from the shape.
  assertGated(
    `
    ${REPO_ROOT_PREAMBLE}
    const source = readFileSync(path.join(repoRoot, 'packages/kit/src', 'thing.ts'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'control: ends in a source literal',
  );
  // Read through a binding, so the path argument is a bare identifier and the
  // shape rule cannot help: only the carried `.text-js` extension can.
  assertClean(
    `
    ${REPO_ROOT_PREAMBLE}
    const file = path.join(repoRoot, 'packages/kit/src/thing.text-js');
    const source = readFileSync(file, 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'hyphenated extension carried through a binding',
  );
});

test('anchors through a helper that returns a repository path', () => {
  // The shape apps/cli/src/output/__tests__/logger.test.ts already uses.
  assertGated(
    `
    function repoRoot() {
      return path.resolve(__dirname, '../../../../..');
    }
    const source = readFileSync(path.join(repoRoot(), 'apps/cli/src/x.ts'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'function declaration',
  );
  assertGated(
    `
    const repoRoot = () => path.resolve(__dirname, '../..');
    const source = readFileSync(path.join(repoRoot(), 'apps/cli/src/x.ts'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'arrow with an expression body',
  );
  // A helper returning a temp directory anchors nothing, whatever it is called.
  assertClean(
    `
    function fixtureRoot() {
      return fs.mkdtempSync(os.tmpdir());
    }
    const source = readFileSync(path.join(fixtureRoot(), 'packages/kit/src/x.ts'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'helper returning a temp directory',
  );
});

test('a whole read stays whole through an encoding conversion', () => {
  assertClean(
    `
    it('x', () => {
      const go = runInNewContext(readFileSync(join(__dirname, 'thing.js')).toString());
      expect(go).toBeDefined();
    });
  `,
    'readFileSync(p).toString()',
  );
  assertClean(
    `
    it('x', () => {
      const go = runInNewContext(String(readFileSync(join(__dirname, 'thing.js'))).trim());
      expect(go).toBeDefined();
    });
  `,
    'String(...).trim()',
  );
  // Control: cutting it is still a fragment however it is spelled.
  assertGated(
    `
    it('x', () => {
      const go = runInNewContext(readFileSync(join(__dirname, 'thing.js')).toString().slice(1));
      expect(go).toBeDefined();
    });
  `,
    'control: sliced after conversion',
  );
});

test('an extensionless literal filename is data whether or not it is hoisted', () => {
  for (const [shape, read] of [
    [
      'inline',
      "readFileSync(path.join(repoRoot, 'apps/mobile/ios/Podfile'), 'utf8')",
    ],
    ['hoisted', "readFileSync(podfile, 'utf8')"],
  ]) {
    assertClean(
      `
      ${REPO_ROOT_PREAMBLE}
      const podfile = path.join(repoRoot, 'apps/mobile/ios/Podfile');
      const source = ${read};
      it('x', () => { expect(source).toContain('pod'); });
    `,
      shape,
    );
  }
  // Control: a genuinely unknown filename in the same directory is source.
  assertGated(
    `
    ${REPO_ROOT_PREAMBLE}
    const directory = path.join(repoRoot, 'apps/mobile/ios');
    const source = readFileSync(path.join(directory, name), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'control: variable filename',
  );
});

test('only a bare call to a path helper anchors', () => {
  // A helper named after a path builder must not disable the head check.
  assertClean(
    `
    const resolve = (rel) => path.resolve(__dirname, rel);
    const source = readFileSync(path.resolve(fs.mkdtempSync(os.tmpdir()), 'index.js'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'builder-named helper does not anchor a temp head',
  );
  // A method call only shares a name with the helper; it is not the helper.
  assertClean(
    `
    function repoRoot() {
      return path.resolve(__dirname, '..');
    }
    const source = readFileSync(path.join(fixture.repoRoot(), 'packages/kit/src/x.ts'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'member call sharing the helper name',
  );
});

test('catches direct evaluation, not only a vm or a transform', () => {
  const setup = `
    const source = readFileSync(join(__dirname, 'thing.js'), 'utf8');
    const fragment = source.slice(source.indexOf('const go ='));
  `;
  assertGated(
    `${setup}
    const go = eval(fragment);
    it('x', () => { expect(go).toBeDefined(); });
  `,
    'eval',
  );
  assertGated(
    `${setup}
    const go = new Function('return ' + fragment)();
    it('x', () => { expect(go).toBeDefined(); });
  `,
    'new Function',
  );
  assertGated(
    `${setup}
    const go = Function(fragment)();
    it('x', () => { expect(go).toBeDefined(); });
  `,
    'Function without new',
  );
  // Whole-file evaluation stays clean through these sinks too.
  assertClean(
    `
    it('x', () => {
      const go = eval(readFileSync(join(__dirname, 'thing.js'), 'utf8'));
      expect(go).toBeDefined();
    });
  `,
    'eval of a whole file',
  );
});

test('covers the rest of the vm surface and indirect eval', () => {
  const setup = `
    const source = readFileSync(join(__dirname, 'thing.js'), 'utf8');
    const fragment = source.slice(source.indexOf('const go ='));
  `;
  assertGated(
    `${setup}
    const go = new vm.Script(fragment).runInNewContext({});
    it('x', () => { expect(go).toBeDefined(); });
  `,
    'new vm.Script',
  );
  assertGated(
    `${setup}
    const go = vm.compileFunction(fragment, [], {});
    it('x', () => { expect(go).toBeDefined(); });
  `,
    'vm.compileFunction',
  );
  assertGated(
    `${setup}
    const go = (0, eval)(fragment);
    it('x', () => { expect(go).toBeDefined(); });
  `,
    'indirect eval',
  );
  assertClean(
    `
    it('x', () => {
      const go = new vm.Script(readFileSync(join(__dirname, 'thing.js'), 'utf8'));
      expect(go).toBeDefined();
    });
  `,
    'control: whole file through vm.Script',
  );
});

test('follows a read through an alias or a one-line wrapper', () => {
  assertGated(
    `
    const read = fs.readFileSync;
    const source = read(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'alias binding',
  );
  assertGated(
    `
    const { readFileSync: slurp } = require('fs');
    const source = slurp(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'destructured rename',
  );
  assertGated(
    `
    import { readFileSync as slurp } from 'fs';
    const source = slurp(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'renamed import',
  );
  assertGated(
    `
    function readSource(file) {
      return fs.readFileSync(file, 'utf8');
    }
    const source = readSource(join(__dirname, 'thing.ts'));
    it('x', () => { expect(source).toContain('go'); });
  `,
    'wrapper taking the path',
  );
  assertGated(
    `
    const readSource = () => fs.readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    const source = readSource();
    it('x', () => { expect(source).toContain('go'); });
  `,
    'wrapper holding the path',
  );
  // The wrapper is not what decides: a fixture path read through one is clean.
  assertClean(
    `
    function readFixture(file) {
      return fs.readFileSync(file, 'utf8');
    }
    it('x', () => {
      const directory = fs.mkdtempSync(os.tmpdir());
      expect(readFixture(join(directory, 'index.js'))).toBe('done');
    });
  `,
    'wrapper reading a temp path',
  );
});

test('a wrapper that splices its parameter into a path defers to the call', () => {
  // The fixture-reader shape: the helper owns the directory, the caller names
  // the file, so the helper alone cannot say whether a call reads source.
  const wrapper = `
    const readFixture = (name) =>
      readFileSync(join(__dirname, '__fixtures__', name), 'utf8');
  `;
  assertClean(
    `${wrapper}
    it('x', () => { expect(readFixture('a.json')).toEqual({}); });
  `,
    'data extension at the call site',
  );
  assertClean(
    `${wrapper}
    it('x', () => { expect(readFixture('Podfile')).toContain('pod'); });
  `,
    'extensionless literal at the call site',
  );
  assertGated(
    `${wrapper}
    it('x', () => { expect(readFixture('a.ts')).toContain('go'); });
  `,
    'control: source extension at the call site',
  );
  assertGated(
    `${wrapper}
    it('x', () => { expect(readFixture(name)).toContain('go'); });
  `,
    'control: the caller does not name the file either',
  );
});

test('a wrapper whose parameter is the path head defers anchoring too', () => {
  const wrapper = `
    function readIn(root) {
      return readFileSync(join(root, 'index.ts'), 'utf8');
    }
  `;
  assertGated(
    `${wrapper}
    const source = readIn(path.join(__dirname, '../src'));
    it('x', () => { expect(source).toContain('go'); });
  `,
    'caller passes a repository path',
  );
  assertClean(
    `${wrapper}
    it('x', () => {
      const source = readIn(fs.mkdtempSync(os.tmpdir()));
      expect(source).toBe('done');
    });
  `,
    'caller passes a temp directory',
  );
  // An unrelated binding that happens to share the parameter name must not
  // decide the verdict for every call.
  assertClean(
    `
    const root = 'apps/web/src/root.ts';
    ${wrapper}
    it('x', () => {
      const source = readIn(fs.mkdtempSync(os.tmpdir()));
      expect(source).toBe('done');
    });
  `,
    'a same-named binding elsewhere in the file',
  );
});

test('a read inside an iteration callback still reaches the assertion', () => {
  assertGated(
    `
    const files = ['a.ts'];
    it('x', () => {
      expect(
        files.filter((file) => readFileSync(join(__dirname, file), 'utf8').includes('go')),
      ).toEqual([]);
    });
  `,
    'filter',
  );
  assertGated(
    `
    const files = ['a.ts'];
    it('x', () => {
      expect(
        files.flatMap((file) => readFileSync(join(__dirname, file), 'utf8').split(',')),
      ).toHaveLength(2);
    });
  `,
    'flatMap',
  );
  // A callback that never reads source keeps the result untainted.
  assertClean(
    `
    const files = ['a.ts'];
    it('x', () => {
      expect(files.filter((file) => file.endsWith('.ts'))).toEqual(['a.ts']);
    });
  `,
    'callback without a read',
  );
});

test('a callback taints only what it hands back', () => {
  const tainted = `const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');`;
  // A property or key that merely shares a name with a tainted binding is not
  // that binding.
  assertClean(
    `${tainted}
    const items = [];
    it('x', () => { expect(items.map((item) => item.source)).toEqual([]); });
  `,
    'member property named source',
  );
  assertClean(
    `${tainted}
    const items = [];
    it('x', () => { expect(items.map((item) => ({ source: item.id }))).toEqual([]); });
  `,
    'object key named source',
  );
  // A read that does not decide the result does not taint it.
  assertClean(
    `
    const files = ['a'];
    it('x', () => {
      expect(
        files.map((file) => {
          const contents = readFileSync(join(__dirname, file), 'utf8');
          parse(contents);
          return file;
        }),
      ).toEqual(['a']);
    });
  `,
    'read for a side effect only',
  );
  // Controls: a returned read still counts, from either body form.
  assertGated(
    `
    const files = ['a.ts'];
    it('x', () => {
      expect(
        files.filter((file) => readFileSync(join(__dirname, file), 'utf8').includes('go')),
      ).toEqual([]);
    });
  `,
    'control: expression body',
  );
  assertGated(
    `
    const files = ['a.ts'];
    it('x', () => {
      expect(
        files.map((file) => {
          const contents = readFileSync(join(__dirname, file), 'utf8');
          return contents.includes('go');
        }),
      ).toEqual([false]);
    });
  `,
    'control: block body returning the read',
  );
});

test('a one-line transform helper carries the text it was given', () => {
  assertGated(
    `
    function normalize(text) {
      return text.replace(/x/gu, ' ');
    }
    const files = ['a.ts'];
    it('x', () => {
      expect(
        files.filter((file) =>
          normalize(readFileSync(join(__dirname, file), 'utf8')).includes('go'),
        ),
      ).toEqual([]);
    });
  `,
    'read reworked by a helper',
  );
  assertClean(
    `
    function increment(value) {
      return value + 1;
    }
    const files = ['a'];
    it('x', () => { expect(files.map((file) => increment(file.length))).toEqual([2]); });
  `,
    'a helper that handles no source',
  );
});

test('chained one-line helpers resolve without crashing the file', () => {
  // A crash here used to be caught and reported as an unparseable file, which
  // dropped every assertion in it from the gate with no failure.
  assertGated(
    `
    const collapse = (text) => text.trim();
    const normalize = (text) => collapse(text).replace(/x/gu, ' ');
    const files = ['a.ts'];
    it('x', () => {
      expect(
        files.filter((file) =>
          normalize(readFileSync(join(__dirname, file), 'utf8')).includes('go'),
        ),
      ).toEqual([]);
    });
  `,
    'helper calling a helper',
  );
  // Declared the other way round, which a single pass in source order misses.
  assertGated(
    `
    const normalize = (text) => collapse(text).replace(/x/gu, ' ');
    const collapse = (text) => text.trim();
    const files = ['a.ts'];
    it('x', () => {
      expect(
        files.filter((file) =>
          normalize(readFileSync(join(__dirname, file), 'utf8')).includes('go'),
        ),
      ).toEqual([]);
    });
  `,
    'helper calling a helper declared after it',
  );
  // A local declared inside the callback reaches the transform helper too.
  assertGated(
    `
    function normalize(text) {
      return text.replace(/x/gu, ' ');
    }
    const files = ['a.ts'];
    it('x', () => {
      expect(
        files.map((file) => {
          const contents = readFileSync(join(__dirname, file), 'utf8');
          return normalize(contents);
        }),
      ).toEqual([]);
    });
  `,
    'callback local through a transform',
  );
});

test('text a read hands to a callback or a promise is still source', () => {
  const thing = "join(__dirname, 'thing.ts')";
  assertGated(
    `
    it('x', (done) => {
      readFile(${thing}, 'utf8', (error, text) => {
        expect(text).toContain('go');
        done();
      });
    });
  `,
    'node-style callback',
  );
  assertGated(
    `
    it('x', () =>
      fs.promises.readFile(${thing}, 'utf8').then((text) => {
        expect(text).toContain('go');
      }));
  `,
    'then',
  );
  assertGated(
    `
    it('x', async () => {
      const text = await new Promise((resolve, reject) => {
        fs.readFile(${thing}, 'utf8', (error, data) =>
          error ? reject(error) : resolve(data),
        );
      });
      expect(text).toContain('go');
    });
  `,
    'wrapped in a promise',
  );
  assertGated(
    `
    it('x', async () => {
      const text = await new Promise((resolve) => {
        fs.promises.readFile(${thing}, 'utf8').then(resolve);
      });
      expect(text).toContain('go');
    });
  `,
    'resolve handed on by reference',
  );
  assertGated(
    `
    const readText = promisify(fs.readFile);
    it('x', async () => {
      expect(await readText(${thing}, 'utf8')).toContain('go');
    });
  `,
    'promisified',
  );
  assertGated(
    `
    it('x', async () => {
      const [before, after] = await Promise.all([
        readFile(${thing}, 'utf8'),
        readFile(${thing}, 'utf8'),
      ]);
      expect(after).toContain(before);
    });
  `,
    'Promise.all',
  );
  assertGated(
    `
    it('x', async () => {
      const text = await Promise.race([readFile(${thing}, 'utf8'), timeout()]);
      expect(text).toContain('go');
    });
  `,
    'Promise.race',
  );
  // Each settled value is its own: data loaded next to source is still data.
  const loadPair = `
      const [source, fixture] = await Promise.all([
        readFile(${thing}, 'utf8'),
        readFile(join(tmp, 'expected.json'), 'utf8'),
      ]);`;
  assertGated(
    `it('x', async () => { ${loadPair} expect(source).toContain('go'); });`,
    'Promise.all: the source half',
  );
  assertClean(
    `it('x', async () => { ${loadPair} expect(fixture).toEqual('{}'); });`,
    'control: Promise.all: the data half',
  );
  // Promise.allSettled settles into records, and only `value` holds an input.
  const settlePair = `
      const [sourceResult, fixtureResult] = await Promise.allSettled([
        readFile(${thing}, 'utf8'),
        readFile(join(tmp, 'expected.json'), 'utf8'),
      ]);`;
  assertGated(
    `it('x', async () => { ${settlePair} expect(sourceResult.value).toContain('go'); });`,
    'Promise.allSettled: the source value',
  );
  assertClean(
    `
    it('x', async () => {
      ${settlePair}
      expect(fixtureResult.value).toEqual('{}');
      expect(sourceResult.status).toBe('fulfilled');
    });
  `,
    'control: Promise.allSettled: the data value, and a status',
  );
  // A nested pattern takes each part of a record on its own.
  const settleNested = `const [{ status, value }] = await Promise.allSettled([readFile(${thing}, 'utf8')]);`;
  assertGated(
    `it('x', async () => { ${settleNested} expect(value).toContain('go'); });`,
    'Promise.allSettled: a nested pattern, the value',
  );
  assertClean(
    `it('x', async () => { ${settleNested} expect(status).toBe('fulfilled'); });`,
    'control: Promise.allSettled: a nested pattern, the status',
  );
  // Controls: the same callback reading data, and a promise holding no source.
  assertClean(
    `
    it('x', (done) => {
      readFile(join(__dirname, 'fixture.json'), 'utf8', (error, text) => {
        expect(text).toContain('go');
        done();
      });
    });
  `,
    'control: callback reading a data file',
  );
  assertClean(
    `
    it('x', () => load().then((value) => { expect(value).toContain('go'); }));
  `,
    'control: then on a promise that holds no source',
  );
  // A whole file handed on whole is not a fragment.
  assertClean(
    `
    it('x', () =>
      readFile(${thing}, 'utf8').then((code) => {
        expect(runInNewContext(code)).toBeDefined();
      }));
  `,
    'control: evaluating the whole file a then receives',
  );
});

test('an element of source text is source, however it is iterated', () => {
  const tainted = `const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');`;
  assertGated(
    `${tainted}
    it('x', () => {
      source.split('\\n').forEach((line) => {
        expect(line).not.toMatch(/console/u);
      });
    });
  `,
    'forEach callback',
  );
  assertGated(
    `${tainted}
    it('x', () => {
      for (const line of source.split('\\n')) {
        expect(line).not.toMatch(/console/u);
      }
    });
  `,
    'for...of',
  );
  assertGated(
    `${tainted}
    it('x', () => {
      source.replace(/import .*/gu, (statement) => {
        expect(statement).not.toContain('lodash');
        return statement;
      });
    });
  `,
    'replace callback',
  );
  assertGated(
    `${tainted}
    function expectNoConsole(line) {
      expect(line).not.toMatch(/console/u);
    }
    it('x', () => { source.split('\\n').forEach(expectNoConsole); });
  `,
    'assertion helper passed by reference',
  );
  // An element is only part of what it came from, even a whole file.
  assertGated(
    `${tainted}
    for (const character of source) {
      runInNewContext(character);
    }
    it('x', () => { expect(1).toBe(1); });
  `,
    'evaluating an element',
  );
  // Controls: the index is not text, and neither is an element of anything else.
  assertClean(
    `${tainted}
    it('x', () => {
      source.split('\\n').forEach((line, index) => {
        expect(index).toBeGreaterThanOrEqual(0);
      });
    });
  `,
    'control: the index parameter',
  );
  assertClean(
    `${tainted}
    it('x', () => {
      for (const name of ['a', 'b']) {
        expect(name).not.toMatch(/console/u);
      }
    });
  `,
    'control: iterating something else',
  );
});

test('what a named function returns is still source', () => {
  const thing = "join(__dirname, 'thing.ts')";
  assertGated(
    `
    const source = readFileSync(${thing}, 'utf8');
    const offsetOf = (needle) => source.indexOf(needle);
    it('x', () => { expect(offsetOf('a')).toBeLessThan(offsetOf('b')); });
  `,
    'closure over source',
  );
  assertGated(
    `
    function loadSource() {
      const file = ${thing};
      return readFileSync(file, 'utf8');
    }
    it('x', () => { expect(loadSource()).toContain('go'); });
  `,
    'several statements',
  );
  // Each property of a returned object literal is its own.
  const loader = `
    function loadIndex() {
      const source = readFileSync(${thing}, 'utf8');
      return { source, ast: parse(source) };
    }`;
  assertGated(
    `${loader}
    it('x', () => { expect(loadIndex().source).toContain('go'); });
  `,
    'the property of a returned object that holds source',
  );
  assertClean(
    `${loader}
    it('x', () => { expect(loadIndex().ast.type).toBe('Program'); });
  `,
    'control: a property of the same object that does not',
  );
  assertClean(
    `${loader}
    it('x', () => {
      const { ast } = loadIndex();
      expect(ast.type).toBe('Program');
    });
  `,
    'control: the same property destructured',
  );
  // A read behind a conversion is still a read helper, classified per call.
  const readText =
    'const readText = (name) => readFileSync(join(__dirname, name)).toString();';
  assertGated(
    `${readText}
    it('x', () => { expect(readText('thing.ts')).toContain('go'); });
  `,
    'read helper through toString, source at the call',
  );
  assertClean(
    `${readText}
    it('x', () => { expect(readText('fixture.json')).toContain('go'); });
  `,
    'control: the same helper reading data',
  );
  // A helper that builds its path and its text in locals first is still a
  // read helper, classified per call.
  const readInSteps = `
    function readSource(name) {
      const file = join(__dirname, 'src', name);
      const text = readFileSync(file, 'utf8');
      return text;
    }`;
  assertGated(
    `${readInSteps}
    it('x', () => { expect(readSource('Thing.ts')).toContain('go'); });
  `,
    'read helper built in locals, source at the call',
  );
  assertClean(
    `${readInSteps}
    it('x', () => { expect(readSource('fixture.json')).toContain('go'); });
  `,
    'control: the same helper reading data',
  );
  const guardedRead = `
    function loadFixture(name) {
      const file = join(__dirname, '__fixtures__', name);
      if (!existsSync(file)) {
        return '';
      }
      return readFileSync(file, 'utf8');
    }
  `;
  assertGated(
    `${guardedRead}
    it('x', () => { expect(loadFixture('Thing.ts')).toContain('go'); });
  `,
    'guarded read helper reading source at the call',
  );
  assertClean(
    `${guardedRead}
    it('x', () => { expect(loadFixture('a.json')).toContain('go'); });
  `,
    'guarded read helper reading data at the call',
  );
  const literalGuardedRead = `
    function loadFixture(name) {
      if (!name) {
        return '';
      }
      return readFileSync(join(__dirname, 'src', name), 'utf8');
    }
  `;
  assertGated(
    `${literalGuardedRead}
    it('x', () => { expect(loadFixture('Thing.ts')).toContain('go'); });
  `,
    'literal guard reading source at the call',
  );
  assertClean(
    `${literalGuardedRead}
    it('x', () => { expect(loadFixture('')).toContain('go'); });
  `,
    'literal guard selecting its fallback at the call',
  );
  const constantGuardedRead = guardedRead.replace(
    "return '';",
    "const empty = '';\n        return empty;",
  );
  assertGated(
    `${constantGuardedRead}
    it('x', () => { expect(loadFixture('Thing.ts')).toContain('go'); });
  `,
    'guarded read helper with a constant fallback reading source at the call',
  );
  const conditionalFallbackRead = `
    function loadFixture(name, useFallback) {
      if (useFallback) {
        return '';
      }
      return readFileSync(join(__dirname, 'src', name), 'utf8');
    }
  `;
  assertClean(
    `${conditionalFallbackRead}
    it('x', () => {
      expect(loadFixture('Thing.ts', true)).toContain('go');
    });
  `,
    'conditional literal fallback is not treated as a source read',
  );
  assertGated(
    `${conditionalFallbackRead}
    it('x', () => {
      expect(loadFixture('Thing.ts', false)).toContain('go');
    });
  `,
    'conditional read branch is still gated',
  );
  const nestedFallbackRead = `
    function loadFixture(name, strict) {
      if (strict) {
        if (!name) {
          return '';
        }
      }
      return readFileSync(join(__dirname, 'src', name), 'utf8');
    }
  `;
  assertGated(
    `${nestedFallbackRead}
    it('x', () => {
      expect(loadFixture('Thing.ts', true)).toContain('go');
    });
  `,
    'nested fallback conditions keep the source read gated',
  );
  assertClean(
    `${nestedFallbackRead}
    it('x', () => {
      expect(loadFixture('', true)).toContain('go');
    });
  `,
    'nested fallback conditions select the fallback when both are true',
  );
  const invertedGuardedRead = `
    function loadFixture(name) {
      if (name) {
        return readFileSync(join(__dirname, 'src', name), 'utf8');
      }
      return '';
    }
  `;
  assertGated(
    `${invertedGuardedRead}
    it('x', () => { expect(loadFixture('Thing.ts')).toContain('go'); });
  `,
    'trailing fallback keeps the guarded source read gated',
  );
  assertClean(
    `${invertedGuardedRead}
    it('x', () => { expect(loadFixture('')).toContain('go'); });
  `,
    'trailing fallback is selected when the read guard is false',
  );
  const switchFallbackRead = `
    function loadFixture(name) {
      switch (name) {
        case 'fallback':
          return '';
        default:
          return readFileSync(join(__dirname, 'src', name), 'utf8');
      }
    }
  `;
  assertClean(
    `${switchFallbackRead}
    it('x', () => { expect(loadFixture('fallback')).toContain('go'); });
  `,
    'switch fallback is selected at the call',
  );
  assertGated(
    `${switchFallbackRead}
    it('x', () => { expect(loadFixture('Thing.ts')).toContain('go'); });
  `,
    'switch read branch is still gated',
  );
  const switchFallthroughRead = `
    function loadFixture(kind) {
      switch (kind) {
        case 'Thing.ts':
        case 'Thing.tsx':
          return readFileSync(join(__dirname, 'src', kind), 'utf8');
        default:
          return '';
      }
    }
  `;
  assertGated(
    `${switchFallthroughRead}
    it('x', () => { expect(loadFixture('Thing.ts')).toContain('go'); });
  `,
    'a fallthrough switch case still selects the source read',
  );
  assertClean(
    `${switchFallthroughRead}
    it('x', () => { expect(loadFixture('json')).toContain('go'); });
  `,
    'the fallthrough switch default still selects its fallback',
  );
  const bracedSwitchRead = `
    function loadFixture(kind) {
      switch (kind) {
        case 'Thing.ts': {
          return readFileSync(join(__dirname, 'src', kind), 'utf8');
        }
        default:
          return '';
      }
    }
  `;
  assertGated(
    `${bracedSwitchRead}
    it('x', () => { expect(loadFixture('Thing.ts')).toContain('go'); });
  `,
    'a braced switch case terminates before the fallback case',
  );
  assertClean(
    `${bracedSwitchRead}
    it('x', () => { expect(loadFixture('fixture.json')).toContain('go'); });
  `,
    'a braced switch default still selects its fallback',
  );
  const constantSwitchRead = `
    const KIND = 'Thing.ts';
    function loadFixture(kind) {
      switch (kind) {
        case KIND:
          return readFileSync(join(__dirname, 'src', kind), 'utf8');
        default:
          return '';
      }
    }
  `;
  assertGated(
    `${constantSwitchRead}
    it('x', () => { expect(loadFixture('Thing.ts')).toContain('go'); });
  `,
    'an unknown switch label keeps the source read conservatively gated',
  );
  const conditionalFallthroughRead = `
    function loadFixture(kind, shouldRead) {
      const file = join(__dirname, 'src', kind);
      switch (kind) {
        case 'Thing.ts':
          if (shouldRead) {
            return readFileSync(file, 'utf8');
          }
        default:
          return '';
      }
    }
  `;
  assertGated(
    `${conditionalFallthroughRead}
    it('x', () => {
      expect(loadFixture('Thing.ts', true)).toContain('go');
    });
  `,
    'a may-fallthrough case does not select the static fallback',
  );
  assertClean(
    `${conditionalFallthroughRead}
    it('x', () => {
      expect(loadFixture('json', false)).toContain('go');
    });
  `,
    'a may-fallthrough default still selects its fallback when unmatched',
  );
  // Whole or cut, as it was returned.
  const script =
    "const code = readFileSync(join(__dirname, 'thing.js'), 'utf8');";
  assertClean(
    `
    function loadScript() {
      ${script}
      return code;
    }
    runInNewContext(loadScript());
    it('x', () => { expect(1).toBe(1); });
  `,
    'control: evaluating a whole file a function returns',
  );
  assertGated(
    `
    function loadBody() {
      ${script}
      return code.slice(code.indexOf('const go ='));
    }
    runInNewContext(loadBody());
    it('x', () => { expect(1).toBe(1); });
  `,
    'evaluating a fragment a function returns',
  );
});

test('what a variable stores under a property is still source', () => {
  const read = "readFileSync(join(__dirname, 'thing.ts'), 'utf8')";
  assertGated(
    `
    const context = {};
    beforeAll(() => { context.source = ${read}; });
    it('x', () => { expect(context.source).toContain('go'); });
  `,
    'assigned in a hook',
  );
  assertGated(
    `
    const context = {};
    beforeAll(() => { context['source'] = ${read}; });
    it('x', () => { expect(context['source']).toContain('go'); });
  `,
    'string keys',
  );
  assertGated(
    `
    const context = {};
    beforeAll(() => { context.source = ${read}; });
    it('x', () => {
      const { source: text } = context;
      expect(text).toContain('go');
    });
  `,
    'destructured out of the variable',
  );
  // A literal spells out what each of its parts holds.
  const literalOwner = `const context = { source: ${read}, count: 3 };`;
  assertGated(
    `${literalOwner}
    it('x', () => {
      const { source } = context;
      expect(source).toContain('go');
    });
  `,
    'destructured out of an object literal',
  );
  assertClean(
    `${literalOwner}
    it('x', () => {
      const { count } = context;
      expect(count).toBe(3);
      expect(context.count).toBe(3);
    });
  `,
    'control: another property of the same object literal',
  );
  assertClean(
    `
    const context = { files: { source: ${read}, count: 3 } };
    it('x', () => { expect(context.files.count).toBe(3); });
  `,
    'control: another property of a nested object literal',
  );
  const nestedOwner = `const context = { files: { source: ${read}, count: 3 } };`;
  assertGated(
    `${nestedOwner}
    it('x', () => {
      const { files: { source } } = context;
      expect(source).toContain('go');
    });
  `,
    'a nested pattern over a nested literal',
  );
  assertClean(
    `${nestedOwner}
    it('x', () => {
      const { files: { count } } = context;
      expect(count).toBe(3);
    });
  `,
    'control: the same nested pattern, another property',
  );
  // A spread written after a property can replace it.
  const payload = `const payload = { source: ${read} };`;
  assertGated(
    `${payload}
    const context = { files: { source: 'plain', ...payload } };
    it('x', () => { expect(context.files.source).toContain('go'); });
  `,
    'a property a later spread can replace',
  );
  assertGated(
    `${payload}
    it('x', () => {
      const { source } = { source: 'plain', ...payload };
      expect(source).toContain('go');
    });
  `,
    'the same, destructured out of the literal',
  );
  assertClean(
    `${payload}
    const context = { ...payload, source: 'plain' };
    it('x', () => { expect(context.source).toBe('plain'); });
  `,
    'control: a property written after the spread',
  );
  // A spread can replace a name however the owner came to have it: spelled in
  // an earlier literal, or left out of this literal altogether.
  assertGated(
    `${payload}
    let context = { source: 'plain' };
    context = { source: 'plain', ...payload };
    it('x', () => { expect(context.source).toContain('go'); });
  `,
    'a name spelled in one literal and replaced by a spread in another',
  );
  assertGated(
    `${payload}
    let context = { source: 'plain' };
    context = { ...payload };
    it('x', () => { expect(context.source).toContain('go'); });
  `,
    'a name a later literal leaves to its spread',
  );
  assertClean(
    `${payload}
    let context = { source: 'plain' };
    context = { ...payload, source: 'plain' };
    it('x', () => { expect(context.source).toBe('plain'); });
  `,
    'control: a later literal that spells the name after its spread',
  );
  // What a spread can put under a name is what its argument holds there.
  assertClean(
    `
    const counted = { source: ${read}, count: 3 };
    const context = { count: 1, ...counted };
    it('x', () => { expect(context.count).toBe(3); });
  `,
    'control: a name the spread argument holds no source under',
  );
  // A computed key can be any name, so it can replace a property like a spread.
  assertGated(
    `
    const context = { source: 'plain', [key]: ${read} };
    it('x', () => {
      const { source } = context;
      expect(source).toContain('go');
      expect(context.source).toContain('go');
    });
  `,
    'a property a later computed key can replace',
  );
  assertClean(
    `
    const context = { [key]: ${read}, source: 'plain' };
    it('x', () => { expect(context.source).toBe('plain'); });
  `,
    'control: a property written after the computed key',
  );
  const arrayOwner = `const files = [${read}, 'plain'];`;
  assertGated(
    `${arrayOwner}
    it('x', () => { expect(files[0]).toContain('go'); });
  `,
    'an element of an array literal',
  );
  assertClean(
    `${arrayOwner}
    it('x', () => {
      const [, plain] = files;
      expect(plain).toBe('plain');
      expect(files[1]).toBe('plain');
    });
  `,
    'control: another element of the same array literal',
  );
  // A property that is only ever assigned may still hold whatever the rest of
  // its owner does.
  assertGated(
    `
    function expectBody(page) {
      page.body = page.body.trim();
      expect(page.body).toContain('go');
    }
    it('x', () => { expectBody({ body: ${read} }); });
  `,
    'reassigned from itself on a parameter',
  );
  // Controls: another property of it, and the same name on another variable.
  assertClean(
    `
    const context = {};
    const other = { source: 'plain' };
    beforeAll(() => {
      context.source = ${read};
      context.count = 1;
    });
    it('x', () => {
      expect(context.count).toBe(1);
      expect(other.source).toContain('go');
    });
  `,
    'control: other properties and other variables',
  );
  // A whole file stored in an object literal is still the whole file.
  assertClean(
    `
    const files = { script: readFileSync(join(__dirname, 'thing.js'), 'utf8') };
    runInNewContext(files.script);
    it('x', () => { expect(1).toBe(1); });
  `,
    'control: evaluating a whole file an object holds',
  );
  assertClean(
    `
    const files = { script: readFileSync(join(__dirname, 'thing.js'), 'utf8') };
    const { script } = files;
    runInNewContext(script);
    it('x', () => { expect(1).toBe(1); });
  `,
    'control: evaluating a whole file destructured out of an object',
  );
});

test('a path moved into a binding classifies like the path itself', () => {
  assertGated(
    `
    it.each(['thing'])('x', (name) => {
      const file = path.join(__dirname, name);
      expect(readFileSync(file, 'utf8')).toContain('go');
    });
  `,
    'sibling of the test named by a variable',
  );
  assertGated(
    `
    const file = require.resolve('../thing');
    const source = readFileSync(file, 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'module specifier',
  );
  // Control: a path whose head is built on __dirname but that names a
  // directory holding no source is still not source.
  assertClean(
    `${REPO_ROOT_PREAMBLE}
    const file = path.join(repoRoot, '.github/workflows', name);
    const source = readFileSync(file, 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'control: a workflow named by a variable',
  );
});

test('a default value is one more value its identifier can hold', () => {
  const read = "readFileSync(join(__dirname, 'thing.ts'), 'utf8')";
  assertGated(
    `
    it('x', () => {
      const { source = ${read} } = {};
      expect(source).toContain('go');
    });
  `,
    'destructuring default',
  );
  assertGated(
    `
    it.each([undefined])('x', (text = ${read}) => {
      expect(text).toContain('go');
    });
  `,
    'parameter default',
  );
  assertClean(
    `
    it('x', () => {
      const { count = 3 } = {};
      expect(count).toBe(3);
    });
  `,
    'control: a default that holds no source',
  );
});

test('a transform helper that cuts text does not launder a fragment', () => {
  const read = "readFileSync(join(__dirname, 'thing.js'), 'utf8')";
  assertGated(
    `
    const cut = (text) => text.slice(text.indexOf('const go ='));
    it('x', () => {
      const go = runInNewContext(cut(${read}));
      expect(go).toBeDefined();
    });
  `,
    'slice inside the helper',
  );
  // Control: a helper that only trims hands the whole file back.
  assertClean(
    `
    const tidy = (text) => text.trim();
    it('x', () => {
      const go = runInNewContext(tidy(${read}));
      expect(go).toBeDefined();
    });
  `,
    'control: trim inside the helper',
  );
});

test('a binding cut anywhere is a fragment wherever it is evaluated', () => {
  assertGated(
    `
    let code = readFileSync(join(__dirname, 'thing.js'), 'utf8');
    code = code.slice(code.indexOf('const go ='));
    runInNewContext(code, {});
    it('x', () => { expect(1).toBe(1); });
  `,
    'read whole, then cut in place',
  );
  // Control: reassigned, but never cut.
  assertClean(
    `
    let code = readFileSync(join(__dirname, 'thing.js'), 'utf8');
    code = code.trim();
    runInNewContext(code, {});
    it('x', () => { expect(1).toBe(1); });
  `,
    'control: reassigned whole',
  );
});

test('anchors, read aliases and helpers resolve by binding, not by name', () => {
  // A temp directory bound under the name the file uses for the repository
  // root is still a temp directory.
  const anchoredRoot = "const root = path.resolve(__dirname, '../..');";
  const readUnderRoot =
    "expect(readFileSync(path.join(root, 'packages/kit/src/Thing.ts'), 'utf8')).toBe('done');";
  assertClean(
    `${anchoredRoot}
    it('x', () => {
      const root = fs.mkdtempSync(os.tmpdir());
      ${readUnderRoot}
    });
  `,
    'temp directory shadowing an anchored name',
  );
  assertGated(
    `${anchoredRoot}
    it('x', () => { ${readUnderRoot} });
  `,
    'control: the anchored binding itself',
  );
  // A parameter that shares an alias's name is not the alias.
  assertClean(
    `
    const read = fs.readFileSync;
    it('x', () => {
      expect(loaders.map((read) => read(join(__dirname, 'thing.ts')))).toEqual([]);
    });
  `,
    'parameter shadowing a read alias',
  );
  assertGated(
    `
    const read = fs.readFileSync;
    it('x', () => {
      expect(loaders.map((loader) => read(join(__dirname, 'thing.ts')))).toEqual([]);
    });
  `,
    'control: the alias itself',
  );
  // A function's own name is looked up around it, not inside it, where a
  // parameter of the same name lives.
  assertGated(
    `
    function contents(contents) {
      expect(contents).toContain('go');
    }
    it('x', () => { contents(readFileSync(join(__dirname, 'thing.ts'), 'utf8')); });
  `,
    'assertion helper whose parameter shares its name',
  );
  // A name nothing declares is one global, wherever it is assigned or read.
  assertGated(
    `
    beforeAll(() => { source = readFileSync(join(__dirname, 'thing.ts'), 'utf8'); });
    it('x', () => { expect(source).toContain('go'); });
  `,
    'undeclared global assigned in a hook',
  );
});

test('a helper asserts for its caller only on text passed in', () => {
  const { violations } = analyzeFile(
    FIXTURE_PATH,
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    function expectMentions(needle) {
      expect(source).toContain(needle);
    }
    it('passes source as the needle', () => { expectMentions(source); });
  `,
  );
  // The assertion is about `source` whatever the caller passes, so it is
  // recorded once, where it is written, and the call adds nothing.
  assert.deepEqual(
    violations
      .filter((violation) => violation.rule === 'source-text-assertion')
      .map((violation) => violation.block),
    [undefined],
  );
});

test('a name the callback binds is its own, not the file-level one', () => {
  const tainted = `const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');`;
  assertClean(
    `${tainted}
    const devices = [];
    it('x', () => { expect(devices.map((source) => source.id)).toEqual([]); });
  `,
    'parameter shadows',
  );
  assertClean(
    `${tainted}
    const items = [];
    it('x', () => {
      expect(
        items.map((item) => {
          try {
            go();
          } catch (source) {
            return source.id;
          }
          return 1;
        }),
      ).toEqual([]);
    });
  `,
    'catch binding shadows',
  );
  assertClean(
    `${tainted}
    const items = [];
    it('x', () => {
      expect(
        items.map((item) => {
          for (const source of item) {
            return source.id;
          }
          return 1;
        }),
      ).toEqual([]);
    });
  `,
    'for-of binding shadows',
  );
  // Control: a callback that really does capture the binding is gated.
  assertGated(
    `${tainted}
    const items = [];
    it('x', () => { expect(items.map((item) => source.includes(item))).toEqual([]); });
  `,
    'control: genuine capture',
  );
});

test('unparseable input throws a SyntaxError and nothing else', () => {
  // analyzeOne tolerates exactly this and rethrows everything else, so that an
  // internal defect cannot drop a file from the gate while looking clean.
  assert.throws(
    () => analyzeFile(FIXTURE_PATH, 'const a = (((;'),
    (error) => error instanceof SyntaxError,
  );
  // The parser recovers from a redeclaration and scope analysis rejects it,
  // which must surface the same way rather than as a crash in this check.
  assert.throws(
    () => analyzeFile(FIXTURE_PATH, 'let a = 1;\nlet a = 2;'),
    (error) => error instanceof SyntaxError,
  );
});

test('an assertion helper is where the claim is made, not where it is spelled', () => {
  assertGated(
    `
    function expectContains(text, needle) {
      expect(text).toContain(needle);
    }
    it('x', () => {
      expectContains(readFileSync(join(__dirname, 'thing.ts'), 'utf8'), 'go');
    });
  `,
    'expect helper',
  );
  assertGated(
    `
    const expectNoTimers = (text) => {
      expect(text).not.toMatch(/setTimeout/u);
    };
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => { expectNoTimers(source); });
  `,
    'arrow helper',
  );
  assertGated(
    `
    function assertClean(text) {
      assert.ok(!text.includes('go'));
    }
    it('x', () => {
      assertClean(readFileSync(join(__dirname, 'thing.ts'), 'utf8'));
    });
  `,
    'node:assert helper, negated',
  );
  // Declared before the helper it hands its parameter to.
  assertGated(
    `
    function expectClean(text) {
      expectNoConsole(text);
    }
    function expectNoConsole(text) {
      expect(text).not.toMatch(/console/u);
    }
    it('x', () => {
      expectClean(readFileSync(join(__dirname, 'thing.ts'), 'utf8'));
    });
  `,
    'helper delegating to a helper',
  );
  // The helper is not what decides: a plain string through it is clean.
  assertClean(
    `
    function expectContains(text, needle) {
      expect(text).toContain(needle);
    }
    it('x', () => { expectContains('plain text', 'go'); });
  `,
    'helper called with no source',
  );
  // A helper that asserts nothing is not an assertion helper.
  assertClean(
    `
    function measure(text) {
      return text.length;
    }
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => { measure(source); });
  `,
    'helper that asserts nothing',
  );
});

test('negation does not launder a claim about source', () => {
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => { expect(!source.includes('go')).toBe(true); });
  `,
    'negated subject',
  );
  assertClean(
    `
    const items = [];
    it('x', () => { expect(!items.length).toBe(true); });
  `,
    'negation with no source in it',
  );
});

test('a local the callback declares shadows the file-level binding', () => {
  const tainted = `const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');`;
  assertClean(
    `${tainted}
    const items = [];
    it('x', () => {
      expect(
        items.map((item) => {
          const source = item.text;
          return source.length;
        }),
      ).toEqual([]);
    });
  `,
    'const from an untainted value',
  );
  assertClean(
    `${tainted}
    const items = [];
    it('x', () => {
      expect(
        items.map((item) => {
          let source;
          source = item.text;
          return source.length;
        }),
      ).toEqual([]);
    });
  `,
    'let assigned an untainted value',
  );
  // Control: the same local built from a read keeps its taint.
  assertGated(
    `${tainted}
    const items = [];
    it('x', () => {
      expect(
        items.map((item) => {
          const source = readFileSync(join(__dirname, item), 'utf8');
          return source.length;
        }),
      ).toEqual([]);
    });
  `,
    'control: local built from a read',
  );
});

test('an assertion helper counts assertions made inside its callbacks', () => {
  const forEachHelper = `
    const expectAllPresent = (text, needles) =>
      needles.forEach((needle) => expect(text).toContain(needle));
  `;
  assertGated(
    `${forEachHelper}
    it('x', () => {
      expectAllPresent(readFileSync(join(__dirname, 'thing.ts'), 'utf8'), ['a']);
    });
  `,
    'sink inside a forEach callback',
  );
  assertGated(
    `
    function describeContract(text) {
      it('inner', () => { expect(text).toContain('go'); });
    }
    describeContract(readFileSync(join(__dirname, 'thing.ts'), 'utf8'));
  `,
    'sink inside an it body',
  );
  assertClean(
    `${forEachHelper}
    it('x', () => { expectAllPresent('plain text', ['a']); });
  `,
    'same helper, no source',
  );
  // A callback that rebinds the name is asserting on its own value.
  assertClean(
    `
    const expectAll = (text, needles) =>
      needles.forEach((text) => expect(text).toBeDefined());
    it('x', () => {
      expectAll(readFileSync(join(__dirname, 'thing.ts'), 'utf8'), ['a']);
    });
  `,
    'inner callback shadows the parameter',
  );
});

test('a helper body is not a claim about an outer binding it shadows', () => {
  const { violations, wholeFile } = analyzeFile(
    FIXTURE_PATH,
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    function expectClean(source) {
      expect(source).not.toContain('x');
    }
    it('asserts through the helper', () => { expectClean(source); });
    it('does something else', () => { expect(1).toBe(1); });
  `,
  );
  const hits = violations.filter(
    (violation) => violation.rule === 'source-text-assertion',
  );
  // One call, one violation, in the block that made it - not a second one
  // from the definition landing in shared setup.
  assert.deepEqual(
    hits.map((hit) => hit.block),
    ['asserts through the helper'],
  );
  assert.equal(wholeFile, false);
});

test('a local filled from a hook or another test is still source', () => {
  assertGated(
    `
    describe('d', () => {
      let source;
      beforeAll(() => {
        source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'describe-level let assigned in beforeAll',
  );
  assertGated(
    `
    describe('d', () => {
      let source = '';
      beforeEach(() => {
        source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'initialised let reassigned in a hook',
  );
  // Jest runs beforeAll before beforeEach whatever order they are written in,
  // so a definition can depend on one that appears below it.
  assertGated(
    `
    describe('d', () => {
      let source;
      let body;
      beforeEach(() => { body = source.slice(source.indexOf('go')); });
      beforeAll(() => { source = readFileSync(join(__dirname, 'thing.ts'), 'utf8'); });
      it('x', () => { expect(body).toContain('go'); });
    });
  `,
    'derived in a hook written above the one that reads',
  );
  assertClean(
    `
    describe('d', () => {
      let source;
      beforeAll(() => { source = 'plain'; });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'hook assigns something untainted',
  );
  // An assignment inside a callback that rebinds the name is to that binding.
  assertClean(
    `
    describe('d', () => {
      let source;
      items.forEach((source) => {
        source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'nested parameter rebinds the name',
  );
});

test('source held in an object literal is still source', () => {
  assertGated(
    `
    it('x', () => {
      expect({ text: readFileSync(join(__dirname, 'thing.ts'), 'utf8') }).toEqual({ text: 'go' });
    });
  `,
    'property value + toEqual',
  );
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => { expect({ source }).toMatchObject({ source: 'go' }); });
  `,
    'shorthand + toMatchObject',
  );
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => { expect({ ...{ source } }).toHaveProperty('source'); });
  `,
    'spread + toHaveProperty',
  );
  // A key that happens to be named source says nothing about the value.
  assertClean(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => { expect({ source: 1 }).toEqual({ source: 1 }); });
  `,
    'key named source, untainted value',
  );
});

test('a hook assignment is read in the hook, and its own bindings stay its own', () => {
  // The right-hand side lives in the hook, so the hook's locals must be visible
  // to it - including when an outer binding of the same name would hide them.
  assertGated(
    `
    describe('d', () => {
      const text = 'outer';
      let source;
      beforeAll(() => {
        const text = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
        source = text;
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'hook-local intermediate under a shadowing outer name',
  );
  assertGated(
    `
    describe('d', () => {
      let source;
      beforeAll(() => {
        items.forEach((file) => {
          const contents = readFileSync(join(__dirname, file), 'utf8');
          source = contents;
        });
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'two levels down',
  );
  // A hook that declares or catches its own `source` is assigning that one.
  assertClean(
    `
    describe('d', () => {
      let source = 'plain';
      beforeAll(() => {
        let source;
        source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'hook redeclares the name',
  );
  assertClean(
    `
    describe('d', () => {
      let source = 'plain';
      beforeAll(() => {
        try {
          go();
        } catch (source) {
          source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
        }
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'hook catch binding rebinds the name',
  );
});

test('a hook local built up by its own callback is followed outward', () => {
  assertGated(
    `
    describe('d', () => {
      let source;
      beforeAll(() => {
        let text = '';
        files.forEach((file) => {
          text += readFileSync(join(__dirname, file), 'utf8');
        });
        source = text;
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'accumulated in a forEach, then assigned out',
  );
  assertClean(
    `
    describe('d', () => {
      let source;
      beforeAll(() => {
        let text = '';
        files.forEach(() => { text += 'plain'; });
        source = text;
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'the loop accumulates something untainted',
  );
  // Reworked after the loop has filled it: the order the statements are
  // written in must not decide whether the taint arrives.
  assertGated(
    `
    describe('d', () => {
      let source;
      beforeAll(() => {
        let text = '';
        files.forEach((file) => {
          text += readFileSync(join(__dirname, file), 'utf8');
        });
        const trimmed = text.trim();
        source = trimmed;
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'reworked after the loop, then assigned out',
  );
  assertClean(
    `
    describe('d', () => {
      let source;
      beforeAll(() => {
        let text = '';
        files.forEach(() => { text += 'plain'; });
        const trimmed = text.trim();
        source = trimmed;
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'the same rework of untainted text',
  );
  // Through intermediates on both sides of the loop.
  assertGated(
    `
    describe('d', () => {
      let source;
      beforeAll(() => {
        let text = '';
        files.forEach((file) => {
          const contents = readFileSync(join(__dirname, file), 'utf8');
          const trimmed = contents.trim();
          text += trimmed;
        });
        const joined = text;
        source = joined;
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'intermediates inside the loop and after it',
  );
  // The loop body's own `text` is a different binding from the hook's.
  assertClean(
    `
    describe('d', () => {
      let source;
      beforeAll(() => {
        let text = '';
        files.forEach((file) => {
          let text = '';
          text += readFileSync(join(__dirname, file), 'utf8');
        });
        source = text;
      });
      it('x', () => { expect(source).toContain('go'); });
    });
  `,
    'the loop redeclares its own text',
  );
});

test('ios and android are skipped only as native project roots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-integrity-dirs-'));
  try {
    const write = (relative, contents = '') => {
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, contents);
    };
    write('ios/Podfile');
    write('ios/Native.test.js');
    write('android/settings.gradle');
    write('android/Native.test.js');
    write('src/ios/Platform.test.ts');
    write('src/android/Platform.test.ts');
    write('out-dir-bundle/ios/Bundled.test.js');

    const found = collectTestFiles(root, [])
      .map((file) => path.relative(root, file).split(path.sep).join('/'))
      .toSorted();

    assert.deepEqual(found, [
      'src/android/Platform.test.ts',
      'src/ios/Platform.test.ts',
    ]);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
});

test('ignores a read anchored at a temp directory', () => {
  // The literal names a .js file, but the path is something the test built.
  assertClean(`
    it('x', () => {
      const directory = mkdtempSync(join(tmpdir(), 'fixture-'));
      const built = readFileSync(join(directory, 'index.js'), 'utf8');
      expect(built).toBe('done');
    });
  `);
});

test('ignores declarative config read from the repository', () => {
  assertClean(`
    const manifest = readFileSync(join(__dirname, 'AndroidManifest.xml'), 'utf8');
    it('x', () => {
      expect(manifest).toContain('android:exported="false"');
    });
  `);
});

test('reports native source as advisory rather than gated', () => {
  const source = `
    const delegate = readFileSync(join(__dirname, 'AppDelegate.swift'), 'utf8');
    it('x', () => {
      expect(delegate).toContain('applicationDidFinishLaunching');
    });
  `;
  const { violations } = analyzeFile(FIXTURE_PATH, source);
  assert.deepEqual(gatedRules(source), []);
  assert.ok(
    violations.some(
      (violation) => violation.rule === 'native-source-text-assertion',
    ),
  );
});

test('an advisory hit alone never produces a whole-file verdict', () => {
  const { wholeFile } = analyzeFile(
    FIXTURE_PATH,
    `
    const delegate = readFileSync(join(__dirname, 'AppDelegate.swift'), 'utf8');
    it('x', () => {
      expect(delegate).toContain('a');
    });
    it('y', () => {
      expect(delegate).toContain('b');
    });
  `,
  );
  assert.equal(wholeFile, false);
});

test('a gated hit in every block produces a whole-file verdict', () => {
  const { wholeFile } = analyzeFile(
    FIXTURE_PATH,
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => {
      expect(source).toContain('a');
    });
    it('y', () => {
      expect(source).toContain('b');
    });
  `,
  );
  assert.equal(wholeFile, true);
});

test('a parameterized test is one block, whatever it is chained from', () => {
  const source = `const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');`;
  // `it.each(table)` only builds the block, so a file whose one test violates
  // is still a whole-file violation.
  const each = analyzeFile(
    FIXTURE_PATH,
    `${source}
    it.each(['a', 'b'])('mentions %s', (needle) => {
      expect(source).toContain(needle);
    });
  `,
  );
  assert.deepEqual(
    each.testBlocks.map((block) => block.title),
    ['mentions %s'],
  );
  assert.equal(each.wholeFile, true);
  const only = analyzeFile(
    FIXTURE_PATH,
    `${source}
    it.only.each(['a'])('only mentions %s', (needle) => {
      expect(source).toContain(needle);
    });
  `,
  );
  assert.deepEqual(
    only.violations
      .filter((violation) => violation.rule === 'source-text-assertion')
      .map((violation) => violation.block),
    ['only mentions %s'],
  );
});

test('records the enclosing block so an exemption can name it', () => {
  const { violations } = analyzeFile(
    FIXTURE_PATH,
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('keeps the thing out', () => {
      expect(source).not.toContain('thing');
    });
  `,
  );
  assert.equal(violations[0].block, 'keeps the thing out');
});

test('the shipped allowlist matches live violations and stays justified', () => {
  const allowlistPath = path.join(__dirname, 'test-integrity.allowlist.json');
  const { entries } = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  for (const entry of entries) {
    assert.ok(
      fs.existsSync(path.join(__dirname, '../..', entry.file)),
      `${entry.file} does not exist`,
    );
    // Mirrors the loadAllowlist contract: null is the shared-setup form.
    assert.ok(entry.block === null || typeof entry.block === 'string');
    assert.ok(entry.reason.trim().length >= 40, `${entry.file} needs a reason`);
    assert.ok(Number.isInteger(entry.count) && entry.count >= 1);
  }
  // `run()` reports an entry that no longer matches, which is what keeps a
  // stale exemption from silently widening over time.
  const { staleEntries } = require('./test-integrity').run();
  assert.deepEqual(
    staleEntries.map((entry) => entry.file),
    [],
  );
});

test('catches reads anchored without __dirname', () => {
  assertGated(
    `
    const source = readFileSync('packages/kit/src/Thing.ts', 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'cwd-relative literal',
  );
  assertGated(
    `
    const source = readFileSync(path.join(process.cwd(), 'apps/cli/src/x.ts'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'process.cwd()',
  );
  assertGated(
    `
    const source = readFileSync(path.join(path.dirname(__filename), 'x.ts'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    '__filename',
  );
  assertGated(
    `
    const source = readFileSync(require.resolve('../thing'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'require.resolve',
  );
});

// Real tests build their paths off a repoRoot binding, and the fixture has to
// as well: without it these paths are not anchored at all and the assertions
// below would hold no matter what the classifier did.
const REPO_ROOT_PREAMBLE =
  "const repoRoot = path.resolve(__dirname, '../..');\n";

test('follows the extension through the binding that built the path', () => {
  assertGated(
    `${REPO_ROOT_PREAMBLE}
    const file = path.join(repoRoot, 'packages/kit/src/Thing.ts');
    const source = readFileSync(file, 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'source behind a binding',
  );
  // Positive control for the two exclusions below: same shape, source path.
  assertGated(
    `${REPO_ROOT_PREAMBLE}
    const file = path.join(repoRoot, 'packages/kit/src/x.js');
    const source = readFileSync(file, 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'control for the vendored case',
  );
  assertClean(
    `${REPO_ROOT_PREAMBLE}
    const file = path.join(repoRoot, 'node_modules/react-native/x.js');
    const source = readFileSync(file, 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'vendored code behind a binding',
  );
  assertClean(
    `${REPO_ROOT_PREAMBLE}
    const file = path.join(repoRoot, 'apps/mobile/ios/Podfile.lock');
    const source = readFileSync(file, 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'data file behind a binding',
  );
  assertClean(
    `${REPO_ROOT_PREAMBLE}
    const source = readFileSync(path.join(repoRoot, '.github/workflows', name), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'workflow named by a variable',
  );
});

test('a temp directory that mirrors the repository layout stays clean', () => {
  // Nothing but the head-only rule saves this one: the suffix names a real
  // source directory and the file has a source extension.
  assertClean(`
    it('x', () => {
      const root = fs.mkdtempSync(os.tmpdir());
      const packageRoot = path.join(root, 'packages/kit/src');
      expect(readFileSync(path.join(packageRoot, 'Thing.ts'), 'utf8')).toBe('done');
    });
  `);
  // Control: the same read anchored for real is gated.
  assertGated(
    `${REPO_ROOT_PREAMBLE}
    const packageRoot = path.join(repoRoot, 'packages/kit/src');
    it('x', () => {
      expect(readFileSync(path.join(packageRoot, 'Thing.ts'), 'utf8')).toBe('done');
    });
  `,
    'control: genuinely anchored',
  );
});

test('a directory whose last segment is an artifact root is not source', () => {
  assertClean(
    `${REPO_ROOT_PREAMBLE}
    const vendorRoot = path.join(repoRoot, 'apps/desktop/app/node_modules');
    const source = readFileSync(path.join(vendorRoot, 'index.js'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'trailing node_modules segment',
  );
  // Control: same shape without the artifact segment.
  assertGated(
    `${REPO_ROOT_PREAMBLE}
    const sourceRoot = path.join(repoRoot, 'apps/desktop/app/utils');
    const source = readFileSync(path.join(sourceRoot, 'index.js'), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'control: not an artifact root',
  );
});

test('keeps taint across array methods, fallbacks and destructuring', () => {
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('x', () => {
      expect(source.split('\\n').filter((line) => line.includes('go'))).toHaveLength(2);
    });
  `,
    'split().filter()',
  );
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    const body = source.match(/go/u)?.[1] ?? '';
    it('x', () => { expect(body).toContain('go'); });
  `,
    '?? fallback',
  );
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    const [, body] = source.match(/go/u);
    it('x', () => { expect(body).toContain('go'); });
  `,
    'array destructuring',
  );
  assertGated(
    `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    const body = ready ? source.slice(1) : '';
    it('x', () => { expect(body).toContain('go'); });
  `,
    'ternary',
  );
});

test('an exempted block does not drive the whole-file verdict', () => {
  const source = `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('exempted', () => { expect(source).toContain('a'); });
    it('gated', () => { expect(source).toContain('b'); });
  `;
  const allowlist = [
    {
      file: path.relative(path.join(__dirname, '../..'), FIXTURE_PATH),
      rule: 'source-text-assertion',
      block: 'exempted',
      count: 1,
      reason: 'x'.repeat(40),
    },
  ];
  const used = new Map();
  const result = analyzeFile(FIXTURE_PATH, source, allowlist, used);

  assert.equal(used.size, 1);
  assert.deepEqual(
    result.violations
      .filter((violation) => violation.rule === 'source-text-assertion')
      .map((violation) => violation.block),
    ['gated'],
  );
  // Both blocks violate, but only one of them lacks a reviewed exemption, so
  // the file is not a deletion candidate.
  assert.equal(result.wholeFile, false);
});

test('a shared-setup violation is exemptable with block null', () => {
  const source = `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    const fragment = source.slice(source.indexOf('const go ='));
    runInNewContext(transformSync(fragment).code, {});
    it('x', () => { expect(true).toBe(true); });
  `;
  const allowlist = [
    {
      file: path.relative(path.join(__dirname, '../..'), FIXTURE_PATH),
      rule: 'source-slice-eval',
      block: null,
      count: 1,
      reason: 'x'.repeat(40),
    },
  ];
  const used = new Map();
  const result = analyzeFile(FIXTURE_PATH, source, allowlist, used);

  assert.equal(used.size, 1);
  assert.deepEqual(gatedRules(source).length > 0, true);
  assert.deepEqual(
    result.violations.filter(
      (violation) => violation.rule === 'source-slice-eval',
    ),
    [],
  );
});

test('an exemption covers only the number of violations reviewed', () => {
  const source = `
    const source = readFileSync(join(__dirname, 'thing.ts'), 'utf8');
    it('exempted', () => {
      expect(source).toContain('a');
      expect(source).toContain('b');
    });
  `;
  const entry = {
    file: path.relative(path.join(__dirname, '../..'), FIXTURE_PATH),
    rule: 'source-text-assertion',
    block: 'exempted',
    count: 1,
    reason: 'x'.repeat(40),
  };
  const result = analyzeFile(FIXTURE_PATH, source, [entry], new Map());

  // The block was reviewed with one assertion; the second one is new.
  assert.equal(
    result.violations.filter(
      (violation) => violation.rule === 'source-text-assertion',
    ).length,
    1,
  );
});

test('temp directory helper names are not treated as repository anchors', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'test-integrity-'));
  try {
    assertClean(`
      const root = join('${directory.replace(/\\/gu, '/')}', 'pkg');
      const built = readFileSync(join(root, 'index.ts'), 'utf8');
      it('x', () => {
        expect(built).toContain('go');
      });
    `);
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});
