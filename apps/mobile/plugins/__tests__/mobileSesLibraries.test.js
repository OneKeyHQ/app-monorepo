const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');

const babel = require('@babel/core');

const { getMobileLockdownPolyfills } = require('../mobileLockdown');

const root = path.resolve(__dirname, '../../../..');
let directory;

beforeAll(() => {
  fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
  directory = fs.mkdtempSync(path.join(root, '.tmp/mobile-ses-libraries-'));
  for (const [source, output] of [
    ['apps/mobile/src/security/finishMobileLockdown.ts', 'finish.cjs'],
    [
      'packages/shared/src/security/sesHarden/runtimeCheckLibraryTasks.ts',
      'tasks.cjs',
    ],
  ]) {
    const { code } = babel.transformFileSync(path.join(root, source), {
      babelrc: false,
      configFile: false,
      plugins: [
        '@babel/plugin-transform-typescript',
        '@babel/plugin-transform-dynamic-import',
        '@babel/plugin-transform-modules-commonjs',
      ],
    });
    fs.writeFileSync(path.join(directory, output), code);
  }
});

afterAll(() => {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
});

test.each(['main', 'background'])(
  '%s lazily loads real libraries after adapter-local SES 1.15.0 hardening',
  (runtime) => {
    const adapterRequire = createRequire(
      require.resolve('@lavamoat/react-native-lockdown'),
    );
    const input = {
      runtime,
      polyfills: getMobileLockdownPolyfills(),
      adapterVersion: adapterRequire('ses/package.json').version,
      finish: path.join(directory, 'finish.cjs'),
      tasks: path.join(directory, 'tasks.cjs'),
    };
    // Run complete production modules in a child realm. Never harden Jest's realm.
    const source = `
const fs = require('node:fs');
const vm = require('node:vm');
const input = JSON.parse(process.argv[1]);
for (const filename of input.polyfills) vm.runInThisContext(fs.readFileSync(filename, 'utf8'), { filename });
const state = require(input.finish).finishMobileLockdown(input.runtime);
const { SES_LIBRARY_TASKS } = require(input.tasks);
Promise.all(SES_LIBRARY_TASKS.map(async ({name, run}) => ({name, detail: await run()}))).then(checks => {
  process.stdout.write(JSON.stringify({version: input.adapterVersion, state, frozen: Object.isFrozen(Reflect) && Object.isFrozen(Promise.prototype), checks}));
}).catch(error => { process.stderr.write(String(error.stack)); process.exitCode = 1; });
`;
    const result = JSON.parse(
      execFileSync(process.execPath, ['-e', source, JSON.stringify(input)], {
        cwd: root,
        timeout: 20_000,
      }).toString(),
    );
    expect(result.version).toBe('1.15.0');
    expect(result.state).toMatchObject({ runtime, lockdownApplied: true });
    expect(result.frozen).toBe(true);
    expect(result.checks.map((check) => check.name)).toEqual([
      'decimal.js after lockdown',
      'axios after lockdown',
      'bn.js after lockdown',
      'elliptic after lockdown',
      'inversify after lockdown',
    ]);
  },
);
