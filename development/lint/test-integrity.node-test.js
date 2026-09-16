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
    assert.equal(typeof entry.block, 'string');
    assert.ok(entry.reason.trim().length >= 40, `${entry.file} needs a reason`);
  }
  // `run()` reports an entry that no longer matches, which is what keeps a
  // stale exemption from silently widening over time.
  const { staleEntries } = require('./test-integrity').run();
  assert.deepEqual(
    staleEntries.map((entry) => entry.file),
    [],
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
