const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  collectClassIndex,
  collectUiReferences,
  findContractViolations,
  getRepositorySourceFiles,
  parseSource,
  resolveMethodExposure,
} = require('./background-api-contract');

const DECORATOR_IMPORT = `
  import {
    backgroundMethod,
    backgroundMethodForDev,
  } from '@onekeyhq/shared/src/background/backgroundDecorators';
`;

function createAstGetter(sources) {
  const cache = new Map();
  return (filePath) => {
    if (!cache.has(filePath)) {
      cache.set(filePath, parseSource(filePath, sources.get(filePath)));
    }
    return cache.get(filePath);
  };
}

test('collects proxy calls through direct access and aliases', () => {
  const filePath = 'packages/kit/src/example.ts';
  const sources = new Map([
    [
      filePath,
      `
        import backgroundApiProxy from './background/instance/backgroundApiProxy';

        backgroundApiProxy.servicePrime.login();
        globalThis.$$appGlobals.$backgroundApiProxy.servicePrime.logout();
        const { serviceFreshAddress, simpleDb } = backgroundApiProxy;
        serviceFreshAddress.findOwner();
        const prime = simpleDb.prime;
        const { getToken } = prime;
        void getToken;
      `,
    ],
  ]);

  const result = collectUiReferences([filePath], createAstGetter(sources));
  const references = result.references.map(
    ({ kind, method, owner }) => `${kind}:${owner}.${method}`,
  );

  assert.deepEqual(references.toSorted(), [
    'service:serviceFreshAddress.findOwner',
    'service:servicePrime.login',
    'service:servicePrime.logout',
    'simpleDb:prime.getToken',
  ]);
});

test('keeps proxy aliases isolated to their lexical scopes', () => {
  const filePath = 'packages/kit/src/example.ts';
  const sources = new Map([
    [
      filePath,
      `
        import backgroundApiProxy from './background/instance/backgroundApiProxy';

        function readPrime() {
          const service = backgroundApiProxy.servicePrime;
          service.login();
        }

        function readFreshAddress() {
          const service = backgroundApiProxy.serviceFreshAddress;
          service.findOwner();
        }

        function unrelated(service) {
          service.notABackgroundCall();
        }
      `,
    ],
  ]);

  const result = collectUiReferences([filePath], createAstGetter(sources));
  const references = result.references.map(
    ({ method, owner }) => `${owner}.${method}`,
  );

  assert.deepEqual(references.toSorted(), [
    'serviceFreshAddress.findOwner',
    'servicePrime.login',
  ]);
});

test('resolves lazy proxy callbacks without leaking parameter bindings', () => {
  const filePath = 'packages/kit/src/example.ts';
  const sources = new Map([
    [
      filePath,
      `
        getBackgroundApiProxy().then((backgroundApiProxy) =>
          backgroundApiProxy.servicePrime.login(),
        );

        function unrelated(backgroundApiProxy) {
          backgroundApiProxy.servicePrime.notABackgroundCall();
        }
      `,
    ],
  ]);

  const result = collectUiReferences([filePath], createAstGetter(sources));

  assert.deepEqual(
    result.references.map(({ method, owner }) => `${owner}.${method}`),
    ['servicePrime.login'],
  );
});

test('rejects dynamic proxy access and ignores direct in-process background access', () => {
  const filePath = 'packages/kit/src/example.ts';
  const sources = new Map([
    [
      filePath,
      `
        import backgroundApiProxy from './background/instance/backgroundApiProxy';

        backgroundApiProxy.servicePrime[methodName]();
        appGlobals.$backgroundApiProxy.backgroundApi.serviceHardware.getSDKInstance();
      `,
    ],
  ]);

  const result = collectUiReferences([filePath], createAstGetter(sources));

  assert.equal(result.dynamicAccesses.length, 1);
  assert.deepEqual(result.references, []);
});

test('resolves decorators through inheritance but rejects undecorated overrides', () => {
  const baseFile = 'packages/kit-bg/src/services/ServiceBase.ts';
  const inheritedFile = 'packages/kit-bg/src/services/ServiceInherited.ts';
  const overrideFile = 'packages/kit-bg/src/services/ServiceOverride.ts';
  const sources = new Map([
    [
      baseFile,
      `
        ${DECORATOR_IMPORT}
        class ServiceBase {
          @backgroundMethod()
          async inherited() {}
        }
      `,
    ],
    [inheritedFile, 'class ServiceInherited extends ServiceBase {}'],
    [
      overrideFile,
      `
        ${DECORATOR_IMPORT}
        class ServiceOverride extends ServiceBase {
          async inherited() {}

          @backgroundMethodForDev()
          async exposedForDev() {}
        }
      `,
    ],
  ]);
  const files = [...sources.keys()];
  const classIndex = collectClassIndex(files, createAstGetter(sources));

  assert.equal(
    resolveMethodExposure(classIndex, 'ServiceInherited', 'inherited').exposed,
    true,
  );
  assert.equal(
    resolveMethodExposure(classIndex, 'ServiceOverride', 'inherited').exposed,
    false,
  );
  assert.equal(
    resolveMethodExposure(classIndex, 'ServiceOverride', 'exposedForDev')
      .exposed,
    true,
  );
});

test('accepts decorator aliases only from backgroundDecorators', () => {
  const validFile = 'packages/kit-bg/src/services/ServiceValid.ts';
  const invalidFile = 'packages/kit-bg/src/services/ServiceInvalid.ts';
  const sources = new Map([
    [
      validFile,
      `
        import {
          backgroundMethod as exposeToBackground,
        } from '@onekeyhq/shared/src/background/backgroundDecorators';

        class ServiceValid {
          @exposeToBackground()
          async exposed() {}
        }
      `,
    ],
    [
      invalidFile,
      `
        import { backgroundMethod } from './unrelatedDecorators';

        class ServiceInvalid {
          @backgroundMethod()
          async hidden() {}
        }
      `,
    ],
  ]);
  const classIndex = collectClassIndex(
    [...sources.keys()],
    createAstGetter(sources),
  );

  assert.equal(
    resolveMethodExposure(classIndex, 'ServiceValid', 'exposed').exposed,
    true,
  );
  assert.equal(
    resolveMethodExposure(classIndex, 'ServiceInvalid', 'hidden').exposed,
    false,
  );
});

test('checks every platform-specific service implementation', () => {
  const iosFile = 'packages/kit-bg/src/services/ServicePlatform.ios.ts';
  const androidFile = 'packages/kit-bg/src/services/ServicePlatform.android.ts';
  const sources = new Map([
    [
      iosFile,
      `
        ${DECORATOR_IMPORT}
        class ServicePlatform {
          @backgroundMethod()
          async exposed() {}
        }
      `,
    ],
    [
      androidFile,
      `
        ${DECORATOR_IMPORT}
        class ServicePlatform {
          @backgroundMethod()
          async exposed() {}
        }
      `,
    ],
  ]);
  const classIndex = collectClassIndex(
    [...sources.keys()],
    createAstGetter(sources),
  );

  assert.equal(
    resolveMethodExposure(classIndex, 'ServicePlatform', 'exposed').exposed,
    true,
  );

  sources.set(androidFile, 'class ServicePlatform { async exposed() {} }');
  const failingClassIndex = collectClassIndex(
    [...sources.keys()],
    createAstGetter(sources),
  );
  assert.equal(
    resolveMethodExposure(failingClassIndex, 'ServicePlatform', 'exposed')
      .exposed,
    false,
  );
});

test('allows simpleDb immediate methods and reports missing decorators', () => {
  const serviceFile = 'packages/kit-bg/src/services/ServicePrime.ts';
  const sources = new Map([
    [
      serviceFile,
      `
        ${DECORATOR_IMPORT}
        class ServicePrime {
          @backgroundMethod()
          async exposed() {}

          async hidden() {}
        }
      `,
    ],
  ]);
  const classIndex = collectClassIndex([serviceFile], createAstGetter(sources));
  const violations = findContractViolations({
    classIndex,
    dynamicAccesses: [],
    immediateMethods: new Set(['customTokens.getLocalValue']),
    references: [
      {
        filePath: 'packages/kit/src/example.ts',
        kind: 'service',
        line: 1,
        method: 'exposed',
        owner: 'servicePrime',
      },
      {
        filePath: 'packages/kit/src/example.ts',
        kind: 'service',
        line: 2,
        method: 'hidden',
        owner: 'servicePrime',
      },
      {
        filePath: 'packages/kit/src/example.ts',
        kind: 'simpleDb',
        line: 3,
        method: 'getLocalValue',
        owner: 'customTokens',
      },
    ],
    serviceTypes: new Map([['servicePrime', 'ServicePrime']]),
    simpleDbTypes: new Map(),
  });

  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /servicePrime\.hidden is not exposed/u);
});

test('ignores tracked source files deleted from the worktree', (t) => {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'background-api-contract-'),
  );
  t.after(() => fs.rmSync(rootDir, { force: true, recursive: true }));
  const deletedFile = path.join(rootDir, 'deleted.ts');
  const existingFile = path.join(rootDir, 'existing.ts');
  spawnSync('git', ['init', '--quiet'], { cwd: rootDir });
  fs.writeFileSync(deletedFile, 'export {};\n');
  fs.writeFileSync(existingFile, 'export {};\n');
  spawnSync('git', ['add', 'deleted.ts'], { cwd: rootDir });
  fs.unlinkSync(deletedFile);

  assert.deepEqual(getRepositorySourceFiles(rootDir), ['existing.ts']);
});
