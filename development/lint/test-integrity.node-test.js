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
  // A callback local must reach a transform helper, which needs the callback's
  // own scope rather than the file-level map.
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
