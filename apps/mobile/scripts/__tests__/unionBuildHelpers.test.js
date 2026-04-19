const {
  buildPostSection,
  buildSerializedModuleEntries,
  buildGraphModuleIndex,
  buildModuleSignature,
  buildRuntimeOwnership,
  collectCommonReferencedSegmentKeys,
  createSerializedModuleToSegmentMap,
  expandSyncDependencyClosure,
  groupSerializedEntriesBySegment,
  rewriteAsyncRequirePaths,
  seedSegmentAssignments,
  validateBundleCompleteness,
} = require('../unionBuildHelpers');

function createModuleData({ code = '', dependencies = [] } = {}) {
  return {
    output: [
      {
        type: 'js/module',
        data: { code },
      },
    ],
    dependencies: new Map(
      dependencies.map(
        ({ key, absolutePath, asyncType = null, isOptional = false }) => [
          key,
          {
            absolutePath,
            data: {
              data: {
                asyncType,
              },
              isOptional,
            },
          },
        ],
      ),
    ),
  };
}

describe('unionBuildHelpers', () => {
  const proxyPath =
    '/repo/packages/kit/src/background/instance/backgroundApiProxy.ts';
  const mainInitPath =
    '/repo/packages/kit/src/background/instance/backgroundApiInit.native-ui.ts';
  const backgroundInitPath =
    '/repo/packages/kit/src/background/instance/backgroundApiInit.ts';

  it('treats same-path modules with different resolved dependencies as runtime variants', () => {
    const mainProxyModule = createModuleData({
      code: 'module.exports = "main";',
      dependencies: [
        {
          key: './backgroundApiInit',
          absolutePath: mainInitPath,
        },
      ],
    });
    const backgroundProxyModule = createModuleData({
      code: 'module.exports = "background";',
      dependencies: [
        {
          key: './backgroundApiInit',
          absolutePath: backgroundInitPath,
        },
      ],
    });

    expect(buildModuleSignature(mainProxyModule)).not.toBe(
      buildModuleSignature(backgroundProxyModule),
    );

    const ownership = buildRuntimeOwnership({
      mainGraph: {
        dependencies: new Map([
          [proxyPath, mainProxyModule],
          [mainInitPath, createModuleData({ code: 'module.exports = "ui";' })],
        ]),
      },
      bgGraph: {
        dependencies: new Map([
          [proxyPath, backgroundProxyModule],
          [
            backgroundInitPath,
            createModuleData({ code: 'module.exports = "bg";' }),
          ],
        ]),
      },
      mainReachable: new Set([proxyPath, mainInitPath]),
      bgReachable: new Set([proxyPath, backgroundInitPath]),
    });

    expect(ownership.sharedEquivalentAbsPaths.has(proxyPath)).toBe(false);
    expect(ownership.sharedStartupAbsPaths.has(proxyPath)).toBe(false);
    expect(ownership.mainOnlyAbsPaths.has(proxyPath)).toBe(true);
    expect(ownership.bgOnlyAbsPaths.has(proxyPath)).toBe(true);
  });

  it('builds serialized segment maps per runtime instead of merging by path', () => {
    const createModuleId = (absolutePath) =>
      ({
        [proxyPath]: 101,
        [mainInitPath]: 201,
        [backgroundInitPath]: 301,
      })[absolutePath];

    const mainModuleIndex = buildGraphModuleIndex(
      {
        dependencies: new Map([
          [proxyPath, createModuleData()],
          [mainInitPath, createModuleData()],
        ]),
      },
      createModuleId,
    );
    const backgroundModuleIndex = buildGraphModuleIndex(
      {
        dependencies: new Map([
          [proxyPath, createModuleData()],
          [backgroundInitPath, createModuleData()],
        ]),
      },
      createModuleId,
    );

    const mainSerializedModuleToSegment = createSerializedModuleToSegmentMap({
      moduleIdToAbsPath: mainModuleIndex.moduleIdToAbsPath,
      absPathToSegment: new Map([[proxyPath, 'seg:proxy.main']]),
    });
    const backgroundSerializedModuleToSegment =
      createSerializedModuleToSegmentMap({
        moduleIdToAbsPath: backgroundModuleIndex.moduleIdToAbsPath,
        absPathToSegment: new Map([[proxyPath, 'seg:proxy.background']]),
      });

    expect(mainSerializedModuleToSegment.get(101)).toBe('seg:proxy.main');
    expect(backgroundSerializedModuleToSegment.get(101)).toBe(
      'seg:proxy.background',
    );
    expect(mainSerializedModuleToSegment.get(201)).toBeUndefined();
    expect(backgroundSerializedModuleToSegment.get(301)).toBeUndefined();
  });

  it('groups emitted segment modules by absolute path instead of graph-local ids', () => {
    const localePath = '/repo/packages/shared/src/locale/zh_CN.json';
    const formPath =
      '/repo/packages/kit/src/views/Setting/components/ApiEndpointForm/index.tsx';

    const segmentOutputs = groupSerializedEntriesBySegment({
      serializedEntries: [
        {
          absolutePath: localePath,
          moduleCode: '__d(locale);',
          moduleData: createModuleData({ code: 'locale' }),
          moduleId: 1390,
        },
        {
          absolutePath: formPath,
          moduleCode: '__d(form);',
          moduleData: createModuleData({ code: 'form' }),
          moduleId: 10_900,
        },
      ],
      absPathToSegment: new Map([
        [localePath, 'seg:shared.locale.json.zh_CN.json'],
        [formPath, 'seg:kit.settings.ApiEndpointForm'],
      ]),
      promotedSegmentKeys: new Set(),
    });

    expect(segmentOutputs.get('seg:shared.locale.json.zh_CN.json')).toEqual([
      [1390, '__d(locale);'],
    ]);
    expect(segmentOutputs.get('seg:kit.settings.ApiEndpointForm')).toEqual([
      [10_900, '__d(form);'],
    ]);
  });

  it('seeds async descendants into the same segment as their async root', () => {
    const seededSegments = seedSegmentAssignments({
      asyncRoots: new Map([
        [100, '/repo/node_modules/react-native-ble-plx/index.js'],
      ]),
      asyncDescendants: new Map([
        [101, 100],
        [102, 100],
      ]),
      deriveSegmentKey: (absolutePath) =>
        absolutePath.includes('react-native-ble-plx')
          ? 'seg:nm.@onekeyfe'
          : 'seg:unknown',
    });

    expect(seededSegments.segmentModules).toEqual(
      new Map([['seg:nm.@onekeyfe', new Set([100, 101, 102])]]),
    );
    expect(seededSegments.moduleToSegment).toEqual(
      new Map([
        [100, 'seg:nm.@onekeyfe'],
        [101, 'seg:nm.@onekeyfe'],
        [102, 'seg:nm.@onekeyfe'],
      ]),
    );
  });

  it('rewrites async require paths with runtime-local segment targets', () => {
    const mainWrappedModules = [
      [1, 'module.exports={"paths":{"101":"old-path"}};'],
    ];
    const backgroundWrappedModules = [
      [1, 'module.exports={"paths":{"101":"old-path"}};'],
    ];

    rewriteAsyncRequirePaths(mainWrappedModules, {
      moduleToSegment: new Map([[101, 'seg:proxy.main']]),
    });
    rewriteAsyncRequirePaths(backgroundWrappedModules, {
      moduleToSegment: new Map([[101, 'seg:proxy.background']]),
    });

    expect(mainWrappedModules[0][1]).toContain('"101":"seg:proxy.main"');
    expect(backgroundWrappedModules[0][1]).toContain(
      '"101":"seg:proxy.background"',
    );
  });

  it('nulls async require paths for modules already available in eager bundles', () => {
    const atomsPath = '/repo/packages/kit-bg/src/states/jotai/atoms/index.ts';
    const localDbPath = '/repo/packages/kit-bg/src/dbs/local/localDb.ts';
    const wrappedModules = [
      [
        1,
        'module.exports={"paths":{"4107":"old-atoms","17793":"old-localdb"}};',
      ],
    ];

    rewriteAsyncRequirePaths(wrappedModules, {
      moduleToSegment: new Map(),
      moduleIdToAbsPath: new Map([
        [4107, atomsPath],
        [17_793, localDbPath],
      ]),
      eagerAbsPaths: new Set([atomsPath, localDbPath]),
    });

    expect(wrappedModules[0][1]).toContain('"4107":null');
    expect(wrappedModules[0][1]).toContain('"17793":null');
  });

  it('emits runtime-specific async path records for shared modules with different runtime ownership', () => {
    const simpleDbPath = '/repo/packages/kit-bg/src/dbs/simple/simpleDb.ts';
    const wrappedModules = [
      [1, 'module.exports={"paths":{"4435":"old-simpledb-path"}};'],
    ];

    rewriteAsyncRequirePaths(wrappedModules, {
      moduleIdToAbsPath: new Map([[4435, simpleDbPath]]),
      runtimeVariants: {
        main: {
          absPathToSegment: new Map([
            [simpleDbPath, 'seg:kit-bg.dbs.simple.simpleDb'],
          ]),
          eagerAbsPaths: new Set(),
        },
        background: {
          absPathToSegment: new Map(),
          eagerAbsPaths: new Set([simpleDbPath]),
        },
      },
    });

    expect(wrappedModules[0][1]).toContain(
      '"4435":{"main":"seg:kit-bg.dbs.simple.simpleDb","background":null}',
    );
  });

  it('prefers segment keys over eager nulling when a module is split out', () => {
    const splitPath = '/repo/src/feature/split.js';
    const wrappedModules = [
      [1, 'module.exports={"paths":{"555":"old-path"}};'],
    ];

    rewriteAsyncRequirePaths(wrappedModules, {
      moduleToSegment: new Map([[555, 'seg:feature.split']]),
      moduleIdToAbsPath: new Map([[555, splitPath]]),
      eagerAbsPaths: new Set([splitPath]),
    });

    expect(wrappedModules[0][1]).toContain('"555":"seg:feature.split"');
    expect(wrappedModules[0][1]).not.toContain('"555":null');
  });

  it('does not rewrite unrelated numeric-key objects outside dependencyMap paths', () => {
    const wrappedModules = [
      [1, 'module.exports={"11":"literal message","paths":{"22":"old-path"}};'],
    ];

    rewriteAsyncRequirePaths(wrappedModules, {
      moduleToSegment: new Map([[22, 'seg:feature.async']]),
      moduleIdToAbsPath: new Map([[11, '/repo/src/message.js']]),
      eagerAbsPaths: new Set(['/repo/src/message.js']),
    });

    expect(wrappedModules[0][1]).toContain('"11":"literal message"');
    expect(wrappedModules[0][1]).toContain('"22":"seg:feature.async"');
  });

  it('uses eager startup ownership instead of broad reachability when provided', () => {
    const sharedPath = '/repo/node_modules/path-browserify/index.js';
    const sharedModule = createModuleData({
      code: 'module.exports = "path";',
    });

    const ownership = buildRuntimeOwnership({
      mainGraph: {
        dependencies: new Map([[sharedPath, sharedModule]]),
      },
      bgGraph: {
        dependencies: new Map([[sharedPath, sharedModule]]),
      },
      mainReachable: new Set([sharedPath]),
      bgReachable: new Set([sharedPath]),
      mainStartupAbsPaths: new Set(),
      bgStartupAbsPaths: new Set([sharedPath]),
    });

    expect(ownership.sharedEquivalentAbsPaths.has(sharedPath)).toBe(true);
    expect(ownership.sharedStartupAbsPaths.has(sharedPath)).toBe(false);
    expect(ownership.mainStartupAbsPaths.has(sharedPath)).toBe(false);
    expect(ownership.bgStartupAbsPaths.has(sharedPath)).toBe(true);
  });

  it('promotes sync deps of shared modules to shared even if only in one graph', () => {
    // defiUtils is shared (in both graphs, same signature).
    // cryptoLib is a sync dep of defiUtils but only in the bg graph.
    // cryptoLib should be promoted to shared so it ends up in common bundle.
    const defiUtilsPath = '/repo/packages/shared/src/utils/defiUtils.ts';
    const cryptoLibPath = '/repo/node_modules/@some/crypto-lib/index.js';

    const defiUtilsModule = createModuleData({
      code: 'module.exports = "defi";',
      dependencies: [{ key: './cryptoLib', absolutePath: cryptoLibPath }],
    });
    const cryptoLibModule = createModuleData({
      code: 'module.exports = "crypto";',
    });

    const ownership = buildRuntimeOwnership({
      mainGraph: {
        dependencies: new Map([
          [defiUtilsPath, defiUtilsModule],
          // cryptoLib NOT in main graph
        ]),
      },
      bgGraph: {
        dependencies: new Map([
          [defiUtilsPath, defiUtilsModule],
          [cryptoLibPath, cryptoLibModule],
        ]),
      },
      mainReachable: new Set([defiUtilsPath]),
      bgReachable: new Set([defiUtilsPath, cryptoLibPath]),
      mainStartupAbsPaths: new Set([defiUtilsPath]),
      bgStartupAbsPaths: new Set([defiUtilsPath, cryptoLibPath]),
    });

    // defiUtils is shared (identical in both graphs, in both startup sets)
    expect(ownership.sharedStartupAbsPaths.has(defiUtilsPath)).toBe(true);
    // cryptoLib should be promoted to shared via sync dep expansion
    expect(ownership.sharedStartupAbsPaths.has(cryptoLibPath)).toBe(true);
    // cryptoLib should NOT remain in bg-only
    expect(ownership.bgStartupAbsPaths.has(cryptoLibPath)).toBe(false);
  });

  it('does not promote async deps of shared modules to shared', () => {
    const sharedModPath = '/repo/packages/shared/src/locale/localeJsonMap.ts';
    const asyncDepPath = '/repo/packages/shared/src/locale/json/zh_CN.json';

    const sharedMod = createModuleData({
      code: 'module.exports = {};',
      dependencies: [
        { key: './zh_CN.json', absolutePath: asyncDepPath, asyncType: 'async' },
      ],
    });
    const asyncDep = createModuleData({ code: '{}' });

    const ownership = buildRuntimeOwnership({
      mainGraph: {
        dependencies: new Map([
          [sharedModPath, sharedMod],
          [asyncDepPath, asyncDep],
        ]),
      },
      bgGraph: {
        dependencies: new Map([
          [sharedModPath, sharedMod],
          [asyncDepPath, asyncDep],
        ]),
      },
      mainReachable: new Set([sharedModPath, asyncDepPath]),
      bgReachable: new Set([sharedModPath, asyncDepPath]),
      mainStartupAbsPaths: new Set([sharedModPath]),
      bgStartupAbsPaths: new Set([sharedModPath]),
    });

    expect(ownership.sharedStartupAbsPaths.has(sharedModPath)).toBe(true);
    // Async dep should NOT be promoted — it stays as a segment
    expect(ownership.sharedStartupAbsPaths.has(asyncDepPath)).toBe(false);
  });

  it('pairs serialized modules with graph paths without reverse id lookup', () => {
    const alphaPath = '/repo/src/alpha.js';
    const betaPath = '/repo/src/beta.js';
    const alphaModule = createModuleData({ code: 'module.exports = "a";' });
    const betaModule = createModuleData({ code: 'module.exports = "b";' });
    const graph = {
      dependencies: new Map([
        [alphaPath, alphaModule],
        [betaPath, betaModule],
      ]),
    };

    const entries = buildSerializedModuleEntries({
      graph,
      moduleIdToAbsPath: new Map([
        [9001, alphaPath],
        [9002, betaPath],
      ]),
      serializedModules: [
        [9001, '__d(alpha);'],
        [9002, '__d(beta);'],
      ],
    });

    expect(entries).toEqual([
      {
        absolutePath: alphaPath,
        moduleCode: '__d(alpha);',
        moduleData: alphaModule,
        moduleId: 9001,
      },
      {
        absolutePath: betaPath,
        moduleCode: '__d(beta);',
        moduleData: betaModule,
        moduleId: 9002,
      },
    ]);
  });

  it('allows serialized subsets when every id resolves to a graph module', () => {
    const graph = {
      dependencies: new Map([
        ['/repo/src/alpha.js', createModuleData({ code: 'alpha' })],
        ['/repo/src/beta.js', createModuleData({ code: 'beta' })],
      ]),
    };

    expect(() =>
      buildSerializedModuleEntries({
        graph,
        moduleIdToAbsPath: new Map([[1, '/repo/src/alpha.js']]),
        serializedModules: [[1, '__d(alpha);']],
      }),
    ).not.toThrow();
  });

  it('throws when a serialized id cannot be resolved back to a graph module', () => {
    const graph = {
      dependencies: new Map([
        ['/repo/src/alpha.js', createModuleData({ code: 'alpha' })],
      ]),
    };

    expect(() =>
      buildSerializedModuleEntries({
        graph,
        moduleIdToAbsPath: new Map(),
        serializedModules: [[1, '__d(alpha);']],
      }),
    ).toThrow('Missing graph module for serialized id 1');
  });

  it('uses module ids instead of graph iteration order for serialized module pairing', () => {
    const initPath = '/repo/src/performance/init.js';
    const enabledPath = '/repo/src/performance/enabled.js';
    const graph = {
      dependencies: new Map([
        [initPath, createModuleData({ code: 'module.exports = "init";' })],
        [
          enabledPath,
          createModuleData({ code: 'module.exports = "enabled";' }),
        ],
      ]),
    };

    const entries = buildSerializedModuleEntries({
      graph,
      moduleIdToAbsPath: new Map([
        [1, initPath],
        [2, enabledPath],
      ]),
      serializedModules: [
        [2, '__d(enabled);'],
        [1, '__d(init);'],
      ],
    });

    expect(entries).toEqual([
      {
        absolutePath: enabledPath,
        moduleCode: '__d(enabled);',
        moduleData: graph.dependencies.get(enabledPath),
        moduleId: 2,
      },
      {
        absolutePath: initPath,
        moduleCode: '__d(init);',
        moduleData: graph.dependencies.get(initPath),
        moduleId: 1,
      },
    ]);
  });

  it('expands startup selection to include synchronous dependency closure', () => {
    const initPath = '/repo/src/performance/init.js';
    const enabledPath = '/repo/src/performance/enabled.js';
    const asyncPath = '/repo/src/performance/async.js';

    const serializedEntries = [
      {
        absolutePath: initPath,
        moduleCode: '__d(init);',
        moduleData: createModuleData({
          code: 'init',
          dependencies: [
            { key: './enabled', absolutePath: enabledPath },
            {
              key: './async',
              absolutePath: asyncPath,
              asyncType: 'async',
            },
          ],
        }),
        moduleId: 1,
      },
      {
        absolutePath: enabledPath,
        moduleCode: '__d(enabled);',
        moduleData: createModuleData({ code: 'enabled' }),
        moduleId: 2,
      },
      {
        absolutePath: asyncPath,
        moduleCode: '__d(async);',
        moduleData: createModuleData({ code: 'async' }),
        moduleId: 3,
      },
    ];

    const selectedAbsPaths = expandSyncDependencyClosure({
      serializedEntries,
      initialIncludedAbsPaths: new Set([initPath]),
      externalAbsPaths: new Set(),
    });

    expect(selectedAbsPaths).toEqual(new Set([initPath, enabledPath]));
  });

  it('does not re-include sync dependencies already provided by common startup', () => {
    const commonPath = '/repo/src/shared/common.js';
    const mainOnlyPath = '/repo/src/main-only.js';

    const selectedAbsPaths = expandSyncDependencyClosure({
      serializedEntries: [
        {
          absolutePath: mainOnlyPath,
          moduleCode: '__d(mainOnly);',
          moduleData: createModuleData({
            code: 'mainOnly',
            dependencies: [{ key: './common', absolutePath: commonPath }],
          }),
          moduleId: 1,
        },
        {
          absolutePath: commonPath,
          moduleCode: '__d(common);',
          moduleData: createModuleData({ code: 'common' }),
          moduleId: 2,
        },
      ],
      initialIncludedAbsPaths: new Set([mainOnlyPath]),
      externalAbsPaths: new Set([commonPath]),
    });

    expect(selectedAbsPaths).toEqual(new Set([mainOnlyPath]));
  });

  it('does not keep externally provided modules when they leak into the initial selection', () => {
    const sharedSingletonPath = '/repo/src/shared/jotaiStorage.js';
    const mainOnlyPath = '/repo/src/main/GlobalJotaiReady.js';

    const selectedAbsPaths = expandSyncDependencyClosure({
      serializedEntries: [
        {
          absolutePath: mainOnlyPath,
          moduleCode: '__d(mainOnly);',
          moduleData: createModuleData({
            code: 'mainOnly',
            dependencies: [
              { key: './jotaiStorage', absolutePath: sharedSingletonPath },
            ],
          }),
          moduleId: 1,
        },
        {
          absolutePath: sharedSingletonPath,
          moduleCode: '__d(sharedSingleton);',
          moduleData: createModuleData({ code: 'sharedSingleton' }),
          moduleId: 2,
        },
      ],
      initialIncludedAbsPaths: new Set([mainOnlyPath, sharedSingletonPath]),
      externalAbsPaths: new Set([sharedSingletonPath]),
    });

    expect(selectedAbsPaths).toEqual(new Set([mainOnlyPath]));
  });

  it('emits common post requires only for included run-before-main modules', () => {
    const postSection = buildPostSection({
      bundleOptions: {
        runModule: true,
        runBeforeMainModule: ['/repo/init-a.js', '/repo/init-b.js'],
        createModuleId: (modulePath) =>
          ({
            '/repo/init-a.js': 11,
            '/repo/init-b.js': 22,
            '/repo/index.js': 33,
          })[modulePath],
        getRunModuleStatement: (moduleId) => `__r(${moduleId})`,
        globalPrefix: '',
      },
      entryPoint: '/repo/index.js',
      includePre: true,
      includedModulePaths: new Set(['/repo/init-b.js']),
    });

    expect(postSection).toBe('__r(22);\n');
  });

  it('emits entry post require only when the entry module is included', () => {
    const buildEntryPost = (includedModulePaths) =>
      buildPostSection({
        bundleOptions: {
          runModule: true,
          runBeforeMainModule: ['/repo/init-a.js'],
          createModuleId: (modulePath) =>
            ({
              '/repo/init-a.js': 11,
              '/repo/index.js': 33,
            })[modulePath],
          getRunModuleStatement: (moduleId) => `__r(${moduleId})`,
          globalPrefix: '',
        },
        entryPoint: '/repo/index.js',
        includePre: false,
        includedModulePaths,
      });

    expect(buildEntryPost(new Set(['/repo/index.js']))).toBe('__r(33);\n');
    expect(buildEntryPost(new Set())).toBe('');
  });

  it('detects modules that are referenced but not in any bundle or segment', () => {
    const aModule = createModuleData({
      code: 'a',
      dependencies: [{ key: './b', absolutePath: '/b.js' }],
    });
    const bModule = createModuleData({ code: 'b' });

    const graph = new Map([
      ['/a.js', aModule],
      ['/b.js', bModule],
    ]);

    const result = validateBundleCompleteness({
      graph,
      eagerAbsPaths: ['/a.js'],
      segmentAbsPaths: [],
      allGraphAbsPaths: ['/a.js', '/b.js'],
    });

    expect(result.valid).toBe(false);
    expect(result.missingAbsPaths).toContain('/b.js');
  });

  it('passes when all referenced modules are in eager or segment', () => {
    const aModule = createModuleData({
      code: 'a',
      dependencies: [{ key: './b', absolutePath: '/b.js' }],
    });
    const bModule = createModuleData({ code: 'b' });

    const graph = new Map([
      ['/a.js', aModule],
      ['/b.js', bModule],
    ]);

    const result = validateBundleCompleteness({
      graph,
      eagerAbsPaths: ['/a.js', '/b.js'],
      segmentAbsPaths: [],
      allGraphAbsPaths: ['/a.js', '/b.js'],
    });

    expect(result.valid).toBe(true);
    expect(result.missingAbsPaths).toHaveLength(0);
  });

  it('accepts modules in segments as covered', () => {
    const aModule = createModuleData({
      code: 'a',
      dependencies: [{ key: './b', absolutePath: '/b.js', asyncType: 'async' }],
    });
    const bModule = createModuleData({ code: 'b' });

    const graph = new Map([
      ['/a.js', aModule],
      ['/b.js', bModule],
    ]);

    const result = validateBundleCompleteness({
      graph,
      eagerAbsPaths: ['/a.js'],
      segmentAbsPaths: ['/b.js'],
      allGraphAbsPaths: ['/a.js', '/b.js'],
    });

    expect(result.valid).toBe(true);
  });

  it('detects modules missing from one runtime but present in another', () => {
    const sharedGraph = new Map([
      [
        '/entry.js',
        createModuleData({
          dependencies: [{ key: 'shared', absolutePath: '/shared.js' }],
        }),
      ],
      [
        '/shared.js',
        createModuleData({
          dependencies: [{ key: 'c', absolutePath: '/c.js' }],
        }),
      ],
      ['/c.js', createModuleData({ code: 'module C' })],
    ]);

    const mainEager = new Set(['/entry.js', '/shared.js', '/c.js']);
    const bgEager = new Set(['/entry.js', '/shared.js']); // C missing!

    const mainResult = validateBundleCompleteness({
      graph: sharedGraph,
      eagerAbsPaths: mainEager,
      segmentAbsPaths: new Set(),
    });

    const bgResult = validateBundleCompleteness({
      graph: sharedGraph,
      eagerAbsPaths: bgEager,
      segmentAbsPaths: new Set(),
    });

    expect(mainResult.valid).toBe(true);
    expect(bgResult.valid).toBe(false);
    expect(bgResult.missingAbsPaths).toContain('/c.js');
  });

  it('catches sync dependency of eager module that was incorrectly segmented', () => {
    const graph = new Map([
      [
        '/a.js',
        createModuleData({
          code: 'module A',
          dependencies: [{ key: 'b', absolutePath: '/b.js' }],
        }),
      ],
      ['/b.js', createModuleData({ code: 'module B' })],
    ]);

    const serializedEntries = [
      {
        absolutePath: '/a.js',
        moduleData: graph.get('/a.js'),
        moduleId: 1,
        moduleCode: '',
      },
      {
        absolutePath: '/b.js',
        moduleData: graph.get('/b.js'),
        moduleId: 2,
        moduleCode: '',
      },
    ];

    const expanded = expandSyncDependencyClosure({
      serializedEntries,
      initialIncludedAbsPaths: new Set(['/a.js']),
      externalAbsPaths: new Set(),
    });

    expect(expanded.has('/b.js')).toBe(true);
  });
});

it('expands segments with sync deps not in eager bundle', () => {
  const { expandSegmentsWithSyncDeps } = require('../unionBuildHelpers');

  const serializedEntries = [
    {
      absolutePath: '/seg-root.js',
      moduleId: 100,
      moduleCode: 'seg root code',
      moduleData: createModuleData({
        dependencies: [{ key: 'dep', absolutePath: '/missing-dep.js' }],
      }),
    },
    {
      absolutePath: '/missing-dep.js',
      moduleId: 101,
      moduleCode: 'missing dep code',
      moduleData: createModuleData({}),
    },
    {
      absolutePath: '/eager.js',
      moduleId: 200,
      moduleCode: 'eager code',
      moduleData: createModuleData({}),
    },
  ];

  const segmentOutputs = new Map([['seg:feature', [[100, 'seg root code']]]]);

  const eagerAbsPaths = new Set(['/eager.js']);
  const moduleIdToAbsPath = new Map([
    [100, '/seg-root.js'],
    [101, '/missing-dep.js'],
    [200, '/eager.js'],
  ]);

  const added = expandSegmentsWithSyncDeps({
    segmentOutputs,
    serializedEntries,
    eagerAbsPaths,
    moduleIdToAbsPath,
  });

  expect(added).toBe(1);
  const segModules = segmentOutputs.get('seg:feature');
  expect(segModules).toHaveLength(2);
  expect(segModules[1][0]).toBe(101); // missing-dep was added
});

it('expands transitive sync deps of segment modules (qr-wallet-sdk case)', () => {
  // Reproduces the scenario where qr-wallet-sdk is an ASYNC_DESC (sync child
  // of a Gallery segment) and its transitive deps (e.g. @keystonehq) must
  // also be pulled into the segment. Without this, the transitive deps become
  // orphaned — they exist in the Metro graph but aren't in any bundle or
  // segment, causing runtime blank pages.
  //
  // Graph:
  //   /eager.js (EAGER)
  //     └─ async import('/qr-sdk.js')
  //   /gallery.js (ASYNC_DESC of seg:gallery)
  //     └─ sync import('/qr-sdk.js')   ← qr-sdk becomes ASYNC_DESC
  //   /qr-sdk.js
  //     └─ sync import('/keystonehq.js')  ← transitive dep
  //   /keystonehq.js
  //     └─ sync import('/protobuf.js')    ← 2nd-level transitive dep
  const { expandSegmentsWithSyncDeps } = require('../unionBuildHelpers');

  const serializedEntries = [
    {
      absolutePath: '/gallery.js',
      moduleId: 10,
      moduleCode: '__d(gallery);',
      moduleData: createModuleData({
        dependencies: [{ key: 'qr-sdk', absolutePath: '/qr-sdk.js' }],
      }),
    },
    {
      absolutePath: '/qr-sdk.js',
      moduleId: 20,
      moduleCode: '__d(qr-sdk);',
      moduleData: createModuleData({
        dependencies: [{ key: '@keystonehq', absolutePath: '/keystonehq.js' }],
      }),
    },
    {
      absolutePath: '/keystonehq.js',
      moduleId: 30,
      moduleCode: '__d(keystonehq);',
      moduleData: createModuleData({
        dependencies: [{ key: 'protobuf', absolutePath: '/protobuf.js' }],
      }),
    },
    {
      absolutePath: '/protobuf.js',
      moduleId: 40,
      moduleCode: '__d(protobuf);',
      moduleData: createModuleData({}),
    },
    {
      absolutePath: '/eager.js',
      moduleId: 50,
      moduleCode: '__d(eager);',
      moduleData: createModuleData({}),
    },
  ];

  // Gallery (10) and qr-sdk (20) are already in the segment
  const segmentOutputs = new Map([
    [
      'seg:gallery',
      [
        [10, '__d(gallery);'],
        [20, '__d(qr-sdk);'],
      ],
    ],
  ]);

  const eagerAbsPaths = new Set(['/eager.js']);
  const moduleIdToAbsPath = new Map([
    [10, '/gallery.js'],
    [20, '/qr-sdk.js'],
    [30, '/keystonehq.js'],
    [40, '/protobuf.js'],
    [50, '/eager.js'],
  ]);

  const added = expandSegmentsWithSyncDeps({
    segmentOutputs,
    serializedEntries,
    eagerAbsPaths,
    moduleIdToAbsPath,
  });

  // Both transitive deps should be pulled into the segment
  expect(added).toBe(2);
  const segModules = segmentOutputs.get('seg:gallery');
  const segModuleIds = segModules.map(([id]) => id);
  expect(segModuleIds).toContain(30); // keystonehq
  expect(segModuleIds).toContain(40); // protobuf
});

it('does not expand segments with deps already in eager bundle', () => {
  const { expandSegmentsWithSyncDeps } = require('../unionBuildHelpers');

  const serializedEntries = [
    {
      absolutePath: '/seg-root.js',
      moduleId: 100,
      moduleCode: 'code',
      moduleData: createModuleData({
        dependencies: [{ key: 'dep', absolutePath: '/eager-dep.js' }],
      }),
    },
    {
      absolutePath: '/eager-dep.js',
      moduleId: 101,
      moduleCode: 'code',
      moduleData: createModuleData({}),
    },
  ];

  const segmentOutputs = new Map([['seg:feature', [[100, 'code']]]]);

  const added = expandSegmentsWithSyncDeps({
    segmentOutputs,
    serializedEntries,
    eagerAbsPaths: new Set(['/eager-dep.js']),
    moduleIdToAbsPath: new Map([
      [100, '/seg-root.js'],
      [101, '/eager-dep.js'],
    ]),
  });

  expect(added).toBe(0);
  expect(segmentOutputs.get('seg:feature')).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// collectCommonReferencedSegmentKeys
// ---------------------------------------------------------------------------

describe('collectCommonReferencedSegmentKeys', () => {
  function makeDep(absolutePath, asyncType = null) {
    return {
      absolutePath,
      data: { data: { asyncType } },
    };
  }

  function makeGraph(entries) {
    const deps = new Map();
    for (const [absPath, depList] of entries) {
      deps.set(absPath, {
        dependencies: new Map(depList.map((d, i) => [`dep${i}`, d])),
      });
    }
    return { dependencies: deps };
  }

  it('returns segment keys for async imports from common modules', () => {
    const commonModule = '/common/intlShim.js';
    const polyfillModule = '/node_modules/@formatjs/intl-locale/polyfill.js';

    const graph = makeGraph([
      [commonModule, [makeDep(polyfillModule, 'async')]],
      [polyfillModule, []],
    ]);

    const result = collectCommonReferencedSegmentKeys({
      mainGraph: graph,
      backgroundGraph: graph,
      sharedStartupAbsPaths: new Set([commonModule]),
      mainSegmentAbsPathsByKey: new Map([
        ['seg:nm.@formatjs', new Set([polyfillModule])],
      ]),
      backgroundSegmentAbsPathsByKey: new Map([
        ['seg:nm.@formatjs', new Set([polyfillModule])],
      ]),
    });

    expect(result.has('seg:nm.@formatjs')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('returns empty set when common modules have no async imports', () => {
    const commonModule = '/common/polyfills.js';
    const syncDep = '/common/shim.js';

    const graph = makeGraph([
      [commonModule, [makeDep(syncDep, null)]],
      [syncDep, []],
    ]);

    const result = collectCommonReferencedSegmentKeys({
      mainGraph: graph,
      backgroundGraph: graph,
      sharedStartupAbsPaths: new Set([commonModule]),
      mainSegmentAbsPathsByKey: new Map(),
      backgroundSegmentAbsPathsByKey: new Map(),
    });

    expect(result.size).toBe(0);
  });

  it('returns empty set when async import target is not in any segment', () => {
    const commonModule = '/common/intlShim.js';
    const polyfillModule = '/node_modules/@formatjs/intl-locale/polyfill.js';

    const graph = makeGraph([
      [commonModule, [makeDep(polyfillModule, 'async')]],
      [polyfillModule, []],
    ]);

    const result = collectCommonReferencedSegmentKeys({
      mainGraph: graph,
      backgroundGraph: graph,
      sharedStartupAbsPaths: new Set([commonModule]),
      mainSegmentAbsPathsByKey: new Map(),
      backgroundSegmentAbsPathsByKey: new Map(),
    });

    expect(result.size).toBe(0);
  });

  it('collects from both main and background graphs', () => {
    const commonModule = '/common/locale.js';
    const mainTarget = '/locale/zh.js';
    const bgTarget = '/locale/en.js';

    const mainGraph = makeGraph([
      [commonModule, [makeDep(mainTarget, 'async')]],
    ]);
    const bgGraph = makeGraph([[commonModule, [makeDep(bgTarget, 'async')]]]);

    const result = collectCommonReferencedSegmentKeys({
      mainGraph,
      backgroundGraph: bgGraph,
      sharedStartupAbsPaths: new Set([commonModule]),
      mainSegmentAbsPathsByKey: new Map([
        ['seg:locale.zh', new Set([mainTarget])],
      ]),
      backgroundSegmentAbsPathsByKey: new Map([
        ['seg:locale.en', new Set([bgTarget])],
      ]),
    });

    expect(result.has('seg:locale.zh')).toBe(true);
    expect(result.has('seg:locale.en')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('ignores non-common modules even if they have async imports', () => {
    const nonCommonModule = '/kit/views/Market/index.tsx';
    const target = '/kit/views/Market/detail.tsx';

    const graph = makeGraph([[nonCommonModule, [makeDep(target, 'async')]]]);

    const result = collectCommonReferencedSegmentKeys({
      mainGraph: graph,
      backgroundGraph: graph,
      sharedStartupAbsPaths: new Set(),
      mainSegmentAbsPathsByKey: new Map([
        ['seg:market.detail', new Set([target])],
      ]),
      backgroundSegmentAbsPathsByKey: new Map(),
    });

    expect(result.size).toBe(0);
  });
});
