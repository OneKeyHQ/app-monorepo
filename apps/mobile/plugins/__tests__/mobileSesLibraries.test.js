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
    [
      'packages/shared/src/security/sesHarden/runtimeCheckIntrinsics.ts',
      'intrinsics.cjs',
    ],
    ['packages/shared/src/security/sesHarden/options.ts', 'options.cjs'],
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

test('the shared lock inventory covers SES upstream global intrinsic roots', () => {
  const parser = require('@babel/parser');
  const source = fs.readFileSync(
    path.join(
      path.dirname(require.resolve('ses/package.json')),
      'src/permits.js',
    ),
    'utf8',
  );
  const ast = parser.parse(source, { sourceType: 'module' });
  const expected = new Set();
  ast.program.body.forEach((statement) => {
    const declaration =
      statement.type === 'ExportNamedDeclaration' && statement.declaration;
    if (declaration?.type !== 'VariableDeclaration') return;
    declaration.declarations.forEach((variable) => {
      if (
        ![
          'universalPropertyNames',
          'initialGlobalPropertyNames',
          'sharedGlobalPropertyNames',
          'uniqueGlobalPropertyNames',
        ].includes(variable.id.name)
      )
        return;
      for (const property of variable.init.properties) {
        const name = property.key.name ?? property.key.value;
        // globalThis owns host capabilities; intrinsic hardening does not freeze it.
        if (name !== 'globalThis') expected.add(name);
      }
    });
  });
  const { SES_INTRINSIC_ROOT_NAMES } = require(
    path.join(directory, 'intrinsics.cjs'),
  );
  expect(expected.size).toBeGreaterThan(50);
  expect(new Set(SES_INTRINSIC_ROOT_NAMES).size).toBe(
    SES_INTRINSIC_ROOT_NAMES.length,
  );
  expect(
    [...expected].filter((name) => !SES_INTRINSIC_ROOT_NAMES.includes(name)),
  ).toEqual([]);
});

test.each([
  ['web', 'L1'],
  ['web', 'L2'],
  ['desktop-renderer', 'L2'],
  ['ext-ui', 'L1'],
  ['ext-background', 'L2'],
])(
  '%s %s freezes the same complete intrinsic inventory with SES 2.3.0',
  (runtime, level) => {
    const source = `
const input = JSON.parse(process.argv[1]);
require('ses');
const { getSesLockdownOptions } = require(input.options);
const options = getSesLockdownOptions(input.level, input.runtime);
lockdown(options);
const evidence = require(input.intrinsics).collectSesIntrinsicLockEvidence();
process.stdout.write(JSON.stringify({evidence,evalTaming:options.evalTaming,version:require('ses/package.json').version}));
`;
    const result = JSON.parse(
      execFileSync(
        process.execPath,
        [
          '-e',
          source,
          JSON.stringify({
            runtime,
            level,
            options: path.join(directory, 'options.cjs'),
            intrinsics: path.join(directory, 'intrinsics.cjs'),
          }),
        ],
        { cwd: root, timeout: 20_000 },
      ).toString(),
    );
    expect(result.version).toBe('2.3.0');
    expect(result.evidence.mutable).toEqual([]);
    expect(result.evidence.functions).toBeGreaterThan(300);
    expect(result.evalTaming).toBe(
      runtime.startsWith('ext-')
        ? 'no-eval'
        : `${level === 'L2' ? 'safe' : 'unsafe'}-eval`,
    );
  },
);

test('the intrinsic audit rejects an unhardened realm', () => {
  const { collectSesIntrinsicLockEvidence } = require(
    path.join(directory, 'intrinsics.cjs'),
  );
  expect(collectSesIntrinsicLockEvidence().mutable.length).toBeGreaterThan(300);
});

test.each(['L1', 'L2'])(
  'production web %s keeps library behavior and parseable stacks with restricted Error hooks',
  (level) => {
    const source = `
const input = JSON.parse(process.argv[1]);
process.env.NODE_ENV = 'production';
require('ses');
const options = require(input.options).getSesLockdownOptions(input.level, 'web');
lockdown(options);
const error = new Error('public SES production stack fixture');
const originalPrepare = Error.prepareStackTrace;
let exposedCallSitePower;
try {
  Error.prepareStackTrace = function(error, sites) {
    exposedCallSitePower = sites.some(site => typeof site.getThis === 'function' || typeof site.getFunction === 'function');
    return 'public custom stack fixture';
  };
  void new Error('public callback fixture').stack;
} finally {
  Error.prepareStackTrace = originalPrepare;
}
const { eventFromException, defaultStackParser } = require('@sentry/browser');
const { SES_LIBRARY_TASKS } = require(input.tasks);
Promise.all([
  eventFromException(defaultStackParser, error),
  Promise.all(SES_LIBRARY_TASKS.map(async ({name, run}) => ({name, detail: await run()}))),
]).then(([event, libraries]) => {
  const regex = /key/giu;
  process.stdout.write(JSON.stringify({options, exposedCallSitePower, compile:typeof RegExp.prototype.compile, regexWorks:regex.exec('OneKey KEY').index === 3 && regex.exec('OneKey KEY').index === 7, frames:event.exception.values[0].stacktrace.frames.length, message:event.exception.values[0].value, libraries, evidence:require(input.intrinsics).collectSesIntrinsicLockEvidence()}));
}).catch(error => { process.stderr.write(String(error.stack)); process.exitCode = 1; });
`;
    const result = JSON.parse(
      execFileSync(
        process.execPath,
        [
          '-e',
          source,
          JSON.stringify({
            level,
            options: path.join(directory, 'options.cjs'),
            tasks: path.join(directory, 'tasks.cjs'),
            intrinsics: path.join(directory, 'intrinsics.cjs'),
          }),
        ],
        { cwd: root, timeout: 20_000 },
      ).toString(),
    );
    expect(result.options).toMatchObject({
      regExpTaming: 'safe',
      errorTaming: 'unsafe',
    });
    expect(result.exposedCallSitePower).toBe(false);
    expect(result.compile).toBe('undefined');
    expect(result.regexWorks).toBe(true);
    expect(result.frames).toBeGreaterThan(0);
    expect(result.message).toBe('public SES production stack fixture');
    expect(result.libraries).toHaveLength(5);
    expect(result.evidence.mutable).toEqual([]);
  },
);

test.each(['main', 'background'])(
  '%s lazily loads real libraries after SES 2.3.0 hardening',
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
      intrinsics: path.join(directory, 'intrinsics.cjs'),
    };
    // Run complete production modules in a child realm. Never harden Jest's realm.
    const source = `
const fs = require('node:fs');
const vm = require('node:vm');
const input = JSON.parse(process.argv[1]);
for (const filename of input.polyfills) vm.runInThisContext(fs.readFileSync(filename, 'utf8'), { filename });
const state = require(input.finish).finishMobileLockdown(input.runtime);
const { SES_LIBRARY_TASKS } = require(input.tasks);
const evidence = require(input.intrinsics).collectSesIntrinsicLockEvidence();
Promise.all(SES_LIBRARY_TASKS.map(async ({name, run}) => ({name, detail: await run()}))).then(checks => {
  process.stdout.write(JSON.stringify({version: input.adapterVersion, state, evidence, frozen: Object.isFrozen(Reflect) && Object.isFrozen(Promise.prototype), checks}));
}).catch(error => { process.stderr.write(String(error.stack)); process.exitCode = 1; });
`;
    const result = JSON.parse(
      execFileSync(process.execPath, ['-e', source, JSON.stringify(input)], {
        cwd: root,
        timeout: 20_000,
      }).toString(),
    );
    expect(result.version).toBe('2.3.0');
    expect(result.state).toMatchObject({
      runtime,
      lockdownApplied: true,
      evalTaming: 'no-eval',
    });
    expect(result.frozen).toBe(true);
    expect(result.evidence.mutable).toEqual([]);
    expect(result.evidence.functions).toBeGreaterThan(300);
    expect(result.checks.map((check) => check.name)).toEqual([
      'decimal.js after lockdown',
      'axios after lockdown',
      'bn.js after lockdown',
      'elliptic after lockdown',
      'inversify after lockdown',
    ]);
  },
);
