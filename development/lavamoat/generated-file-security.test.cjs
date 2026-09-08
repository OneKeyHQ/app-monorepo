// cspell:ignore LavaMoat lavamoat NOSYSTEM

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const YAML = require('yaml');

const { isGeneratedPolicyFile } = require('./generated-files.cjs');

const repoRoot = path.resolve(__dirname, '../..');
const workflow = YAML.parse(
  fs.readFileSync(
    path.join(repoRoot, '.github/workflows/update-lavamoat-policies.yml'),
    'utf8',
  ),
);
const applyScript = workflow.jobs['apply-and-commit'].steps.find(
  (step) => step.name === 'Apply policy diffs',
).run;
const fixtureEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'LavaMoat Test',
  GIT_AUTHOR_EMAIL: 'lavamoat-test@example.com',
  GIT_COMMITTER_NAME: 'LavaMoat Test',
  GIT_COMMITTER_EMAIL: 'lavamoat-test@example.com',
};
for (const name of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE']) {
  delete fixtureEnv[name];
}

function execute(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: fixtureEnv,
    encoding: 'utf8',
    shell: false,
  });
  assert.ifError(result.error);
  return result;
}

function git(cwd, args) {
  const result = execute('git', args, cwd);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function write(directory, file, content = '{}\n') {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

const rejectedFiles = [
  'lavamoat/supply-chain/install-scripts.json',
  'lavamoat/webpack/web/policy-override.json',
  'lavamoat/webpack/desktop-renderer/policy-override.json',
  'lavamoat/review/payload.js',
];
const cases = [
  {
    name: 'both policies and regular review JSON/README are allowed',
    allowed: true,
    change(directory) {
      for (const file of [
        'lavamoat/webpack/web/policy.json',
        'lavamoat/webpack/desktop-renderer/policy.json',
        'lavamoat/review/README.review.md',
        'lavamoat/review/webpack/web/new-report.json',
        'lavamoat/review/literal[1].json',
        'lavamoat/review/line\nbreak.json',
      ]) {
        write(directory, file, '{"generated":true}\n');
      }
      fs.unlinkSync(path.join(directory, 'lavamoat/review/obsolete.json'));
    },
  },
  ...rejectedFiles.map((file) => ({
    name: `reject ${file}`,
    allowed: false,
    change(directory) {
      write(directory, file);
    },
  })),
  ...['executable.json', '[missing].json', 'line\nexecutable.json'].map(
    (file) => ({
      name: `reject executable ${JSON.stringify(file)}`,
      allowed: false,
      change(directory) {
        const target = `lavamoat/review/${file}`;
        write(directory, target);
        fs.chmodSync(path.join(directory, target), 0o755);
      },
    }),
  ),
  ...['symlink.json', '[missing].json'].map((file) => ({
    name: `reject symlink ${file}`,
    allowed: false,
    change(directory) {
      fs.symlinkSync(
        '../../src/input.js',
        path.join(directory, 'lavamoat/review', file),
      );
    },
  })),
  {
    name: 'reject rename from outside scope into a review JSON path',
    allowed: false,
    change(directory) {
      git(directory, ['mv', 'src/input.js', 'lavamoat/review/moved.json']);
    },
  },
];

for (const scenario of cases) {
  test(`generated file security: ${scenario.name}`, () => {
    const directory = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-lavamoat-file-security-')),
    );
    try {
      // Paths must remain literal arguments even with shell metacharacters.
      const checkout = path.join(directory, "checkout $HOME; 'quoted'");
      const remote = path.join(directory, "remote 'quoted'; $HOME.git");
      fs.mkdirSync(checkout);
      git(checkout, ['init', '-q']);
      git(checkout, ['config', 'core.fileMode', 'true']);
      for (const file of [
        'src/input.js',
        'lavamoat/webpack/web/policy.json',
        'lavamoat/webpack/desktop-renderer/policy.json',
        'lavamoat/review/README.review.md',
        'lavamoat/review/obsolete.json',
      ]) {
        write(checkout, file, '{"base":true}\n');
      }
      git(checkout, ['add', '-A']);
      git(checkout, ['commit', '-qm', 'test: initialize policy fixture']);
      const headSha = git(checkout, ['rev-parse', 'HEAD']).trim();
      scenario.change(checkout);
      const scope = execute(
        process.execPath,
        [path.join(__dirname, 'check-generated-file-scope.cjs')],
        checkout,
      );
      assert.equal(
        scope.status,
        scenario.allowed ? 0 : 1,
        `${scope.stdout}\n${scope.stderr}`,
      );
      git(checkout, ['add', '-A']);
      const stagedScope = execute(
        process.execPath,
        [path.join(__dirname, 'check-generated-file-scope.cjs')],
        checkout,
      );
      assert.equal(stagedScope.status, scenario.allowed ? 0 : 1);
      const patch = git(checkout, [
        'diff',
        '--cached',
        '--binary',
        '--find-renames',
        'HEAD',
      ]);
      assert.ok(patch);
      git(checkout, ['reset', '--hard', '-q', 'HEAD']);
      git(checkout, ['init', '--bare', '-q', remote]);
      git(checkout, ['remote', 'add', 'origin', remote]);
      write(checkout, 'lavamoat-policy-diffs/input.patch', patch);

      // Execute the actual workflow Bash, including its temporary index,
      // commit-tree, and push. The remote is a disposable local bare repository;
      // no workflow shell logic is duplicated or replaced by a mock.
      const result = spawnSync(
        'bash',
        ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-s'],
        {
          cwd: checkout,
          input: applyScript,
          env: {
            ...fixtureEnv,
            RUNNER_TEMP: directory,
            HEAD_SHA: headSha,
            HEAD_REF_NAME: 'fixture',
          },
          encoding: 'utf8',
          shell: false,
        },
      );
      assert.ifError(result.error);
      assert.equal(
        result.status,
        scenario.allowed ? 0 : 1,
        `${result.stdout}\n${result.stderr}`,
      );
      const pushed = execute(
        'git',
        ['--git-dir', remote, 'rev-parse', '--verify', 'refs/heads/fixture'],
        checkout,
      );
      if (scenario.allowed) {
        assert.equal(pushed.status, 0);
        const changed = git(checkout, [
          '--git-dir',
          remote,
          'diff',
          '--no-renames',
          '--name-only',
          '-z',
          headSha,
          'refs/heads/fixture',
        ])
          .split('\0')
          .filter(Boolean);
        assert.ok(changed.length >= 6);
        assert.ok(changed.every(isGeneratedPolicyFile));
      } else {
        assert.notEqual(
          pushed.status,
          0,
          'rejected patches must never be pushed',
        );
        assert.match(result.stdout, /outside generated policies\/reports/);
      }
      assert.equal(git(checkout, ['rev-parse', 'HEAD']).trim(), headSha);
      assert.equal(git(checkout, ['status', '--porcelain']), '');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('diff output excludes manual inputs and executable review sources', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-lavamoat-filtered-diff-'),
  );
  try {
    git(directory, ['init', '-q']);
    for (const file of rejectedFiles) {
      write(directory, file);
    }
    git(directory, ['add', '-A']);
    git(directory, ['commit', '-qm', 'test: initialize manual inputs']);
    for (const file of rejectedFiles) {
      write(directory, file, '{"changed":true}\n');
    }
    const command = [path.join(__dirname, 'check-policy-diff.cjs')];
    const rejectedOnly = execute(process.execPath, command, directory);
    assert.equal(rejectedOnly.status, 0);
    assert.equal(rejectedOnly.stdout, '');
    write(directory, 'lavamoat/review/new\nreport.json');
    const untracked = execute(process.execPath, command, directory);
    assert.equal(untracked.status, 1, untracked.stderr);
    assert.match(untracked.stdout, /new\\nreport\.json/);
    git(directory, ['add', 'lavamoat/review']);
    const staged = execute(process.execPath, command, directory);
    assert.equal(staged.status, 1, staged.stderr);
    assert.match(staged.stdout, /new\\nreport\.json/);
    assert.doesNotMatch(
      staged.stdout,
      /payload\.js|policy-override|install-scripts/,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('normalization only changes generated policies and preserves manual overrides byte for byte', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'onekey-lavamoat-normalize-scope-'),
  );
  try {
    for (const file of [
      'normalize-policy-artifacts.cjs',
      'targets.cjs',
      'error.cjs',
    ]) {
      write(
        directory,
        `development/lavamoat/${file}`,
        fs.readFileSync(path.join(__dirname, file), 'utf8'),
      );
    }
    const original = '{"resources":{"z":{},"a":{}}}\n';
    for (const target of ['web', 'desktop-renderer']) {
      for (const file of ['policy.json', 'policy-override.json']) {
        write(directory, `lavamoat/webpack/${target}/${file}`, original);
      }
    }
    const result = execute(
      process.execPath,
      [
        path.join(
          directory,
          'development/lavamoat/normalize-policy-artifacts.cjs',
        ),
      ],
      directory,
    );
    assert.equal(result.status, 0, result.stderr);
    for (const target of ['web', 'desktop-renderer']) {
      assert.equal(
        fs.readFileSync(
          path.join(directory, `lavamoat/webpack/${target}/policy.json`),
          'utf8',
        ),
        `${JSON.stringify({ resources: { a: {}, z: {} } }, null, 2)}\n`,
      );
      assert.equal(
        fs.readFileSync(
          path.join(
            directory,
            `lavamoat/webpack/${target}/policy-override.json`,
          ),
          'utf8',
        ),
        original,
      );
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
