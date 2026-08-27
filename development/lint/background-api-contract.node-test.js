const assert = require('node:assert/strict');
const test = require('node:test');

const {
  collectClassIndex,
  collectUiReferences,
  findContractViolations,
  parseSource,
  resolveMethodExposure,
} = require('./background-api-contract');

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

test('allows simpleDb immediate methods and reports missing decorators', () => {
  const serviceFile = 'packages/kit-bg/src/services/ServicePrime.ts';
  const sources = new Map([
    [
      serviceFile,
      `
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
