const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { analyzeFile } = require('./test-integrity');

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

test('evaluating a whole shipped text artifact is not a sliced fragment', () => {
  // The .text-js file is source shipped to another runtime; running it and
  // comparing what it does is the opposite of reconstructing a unit from text.
  assertClean(`
    it('x', () => {
      const go = runInNewContext(
        '(' + readFileSync('packages/kit/src/thing.text-js', 'utf8') + ')',
      );
      expect(go(1)).toBe('one');
    });
  `);
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

test('follows the extension through the binding that built the path', () => {
  assertGated(
    `
    const file = path.join(repoRoot, 'packages/kit/src/Thing.ts');
    const source = readFileSync(file, 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'source behind a binding',
  );
  assertClean(
    `
    const file = path.join(repoRoot, 'node_modules/react-native/x.js');
    const source = readFileSync(file, 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'vendored code behind a binding',
  );
  assertClean(
    `
    const file = path.join(repoRoot, 'apps/mobile/ios/Podfile.lock');
    const source = readFileSync(file, 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'data file behind a binding',
  );
  assertClean(
    `
    const source = readFileSync(path.join(repoRoot, '.github/workflows', name), 'utf8');
    it('x', () => { expect(source).toContain('go'); });
  `,
    'workflow named by a variable',
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
