const {
  buildPostSection,
  buildSerializedModuleEntries,
  buildGraphModuleIndex,
  buildModuleSignature,
  buildRuntimeOwnership,
  collectCommonReferencedSegmentKeys,
  computeSharedPerRuntimeDeps,
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

  // Contract test for the REACT-NATIVE-4AX (iOS 6.3.0-10069276) regression:
  // emitSegment in unionBuild.js must call rewriteAsyncRequirePaths with a
  // segment-shape input — wrappedModules whose source code is a __d(...)
  // factory wrapper containing a Metro async-require dependencyMap with raw
  // ".bundle?modulesOnly=true&runModule=false" URLs. The helper must rewrite
  // those URLs to segment keys for any module that lives in a split segment.
  it('rewrites Metro asyncRequire URLs inside __d() segment-shape modules', () => {
    const segModules = [
      [
        2500,
        '__d(function(){asyncRequire(778, {"paths":{"778":"/packages/kit/src/views/Receive/pages/ReceiveToken.bundle?modulesOnly=true&runModule=false"}});}, 2500, [778]);',
      ],
    ];

    rewriteAsyncRequirePaths(segModules, {
      moduleToSegment: new Map([
        [778, 'seg:kit.views.Receive.pages.ReceiveToken'],
      ]),
      moduleIdToAbsPath: new Map([
        [778, '/repo/packages/kit/src/views/Receive/pages/ReceiveToken.tsx'],
      ]),
      eagerAbsPaths: new Set(),
    });

    expect(segModules[0][1]).toContain(
      '"778":"seg:kit.views.Receive.pages.ReceiveToken"',
    );
    expect(segModules[0][1]).not.toContain('modulesOnly=true&runModule=false');
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

it('mirrors added sync deps into segmentAbsPathsByKey and moduleIdToAbsPath', () => {
  // Guards against the root cause of the @ledgerhq bg-segment orphan
  // incident: expandSegmentsWithSyncDeps used to push [id, code] into
  // segmentOutputs without updating the segmentAbsPathsByKey /
  // moduleIdToAbsPath maps that downstream (manifest writer, integrity
  // check) reads from. That left the emitted .seg.js file carrying
  // __d(... id ...) for the rescued module while idMap.segments didn't
  // list it, triggering false orphan_dep reports.
  const { expandSegmentsWithSyncDeps } = require('../unionBuildHelpers');

  const serializedEntries = [
    {
      absolutePath: '/seg-root.js',
      moduleId: 100,
      moduleCode: 'root',
      moduleData: createModuleData({
        dependencies: [{ key: 'dep', absolutePath: '/missing-dep.js' }],
      }),
    },
    {
      absolutePath: '/missing-dep.js',
      moduleId: 101,
      moduleCode: 'dep',
      moduleData: createModuleData({}),
    },
  ];
  const segmentOutputs = new Map([['seg:feature', [[100, 'root']]]]);
  const segmentAbsPathsByKey = new Map([
    ['seg:feature', new Set(['/seg-root.js'])],
  ]);
  const moduleIdToAbsPath = new Map([[100, '/seg-root.js']]);

  const added = expandSegmentsWithSyncDeps({
    segmentOutputs,
    serializedEntries,
    eagerAbsPaths: new Set(),
    moduleIdToAbsPath,
    segmentAbsPathsByKey,
  });

  expect(added).toBe(1);
  expect(segmentAbsPathsByKey.get('seg:feature').has('/missing-dep.js')).toBe(
    true,
  );
  expect(moduleIdToAbsPath.get(101)).toBe('/missing-dep.js');
});

// ---------------------------------------------------------------------------
// expandSegmentsWithCrossRuntimeDeps
// ---------------------------------------------------------------------------

describe('expandSegmentsWithCrossRuntimeDeps', () => {
  const {
    expandSegmentsWithCrossRuntimeDeps,
  } = require('../unionBuildHelpers');

  function buildEntries(specs) {
    return specs.map((spec) => ({
      absolutePath: spec.absolutePath,
      moduleId: spec.moduleId,
      moduleCode: spec.moduleCode ?? `code:${spec.moduleId}`,
      moduleData: createModuleData({ dependencies: spec.dependencies || [] }),
    }));
  }

  it('pulls a sync dep that exists only in the local runtime into the segment', () => {
    const local = buildEntries([
      {
        absolutePath: '/root.js',
        moduleId: 10,
        dependencies: [{ key: 'dep', absolutePath: '/dep.js' }],
      },
      { absolutePath: '/dep.js', moduleId: 11 },
    ]);
    const remote = [];
    const segmentOutputs = new Map([['seg:a', [[10, 'code:10']]]]);
    const segmentAbsPathsByKey = new Map([['seg:a', new Set(['/root.js'])]]);
    const moduleIdToAbsPath = new Map([[10, '/root.js']]);

    const { pulledFromLocal, pulledFromRemote, missingAbsPaths } =
      expandSegmentsWithCrossRuntimeDeps({
        segmentOutputs,
        localSerializedEntries: local,
        remoteSerializedEntries: remote,
        eagerAbsPaths: new Set(),
        moduleIdToAbsPath,
        segmentAbsPathsByKey,
      });

    expect(pulledFromLocal).toBe(1);
    expect(pulledFromRemote).toBe(0);
    expect(missingAbsPaths).toEqual([]);
    expect(segmentOutputs.get('seg:a').map(([id]) => id)).toContain(11);
    expect(segmentAbsPathsByKey.get('seg:a').has('/dep.js')).toBe(true);
    expect(moduleIdToAbsPath.get(11)).toBe('/dep.js');
  });

  it('falls back to the remote runtime when local lacks the dep', () => {
    // Mirrors the @ledgerhq shared-segment case: the root module lives in
    // the local runtime's segmentOutputs but its sync target (e.g. @ledgerhq/
    // device-management-kit) was only serialized by the other runtime's
    // Metro graph.
    const local = buildEntries([
      {
        absolutePath: '/root.js',
        moduleId: 10,
        dependencies: [{ key: 'dep', absolutePath: '/dep.js' }],
      },
    ]);
    const remote = buildEntries([{ absolutePath: '/dep.js', moduleId: 11 }]);
    const segmentOutputs = new Map([['seg:a', [[10, 'code:10']]]]);
    const segmentAbsPathsByKey = new Map([['seg:a', new Set(['/root.js'])]]);
    const moduleIdToAbsPath = new Map([[10, '/root.js']]);

    const { pulledFromLocal, pulledFromRemote, missingAbsPaths } =
      expandSegmentsWithCrossRuntimeDeps({
        segmentOutputs,
        localSerializedEntries: local,
        remoteSerializedEntries: remote,
        eagerAbsPaths: new Set(),
        moduleIdToAbsPath,
        segmentAbsPathsByKey,
      });

    expect(pulledFromLocal).toBe(0);
    expect(pulledFromRemote).toBe(1);
    expect(missingAbsPaths).toEqual([]);
    expect(segmentOutputs.get('seg:a').map(([id]) => id)).toContain(11);
  });

  it('reports a genuine orphan when neither runtime has the dep', () => {
    const local = buildEntries([
      {
        absolutePath: '/root.js',
        moduleId: 10,
        dependencies: [{ key: 'dep', absolutePath: '/nobody.js' }],
      },
    ]);
    const { missingAbsPaths, pulledFromLocal, pulledFromRemote } =
      expandSegmentsWithCrossRuntimeDeps({
        segmentOutputs: new Map([['seg:a', [[10, 'code:10']]]]),
        localSerializedEntries: local,
        remoteSerializedEntries: [],
        eagerAbsPaths: new Set(),
        moduleIdToAbsPath: new Map([[10, '/root.js']]),
      });

    expect(pulledFromLocal).toBe(0);
    expect(pulledFromRemote).toBe(0);
    expect(missingAbsPaths).toEqual(['/nobody.js']);
  });

  it('ignores deps whose absolutePath is falsy (virtual polyfill shims)', () => {
    // Metro emits a handful of edges with no resolvable absolutePath (virtual
    // shims, sentinel nulls). They must not be reported as orphans because
    // Metro would have failed at bundle time if anything actually required
    // them — counting them as crash risks would be noise.
    const serializedRoot = {
      absolutePath: '/root.js',
      moduleId: 10,
      moduleCode: 'code:10',
      moduleData: {
        output: [{ type: 'js/module', data: { code: '' } }],
        dependencies: new Map([
          ['virtual', { absolutePath: undefined, data: { data: {} } }],
        ]),
      },
    };

    const { missingAbsPaths } = expandSegmentsWithCrossRuntimeDeps({
      segmentOutputs: new Map([['seg:a', [[10, 'code:10']]]]),
      localSerializedEntries: [serializedRoot],
      remoteSerializedEntries: [],
      eagerAbsPaths: new Set(),
      moduleIdToAbsPath: new Map([[10, '/root.js']]),
    });

    expect(missingAbsPaths).toEqual([]);
  });

  it('skips deps reachable via async edges', () => {
    const local = buildEntries([
      {
        absolutePath: '/root.js',
        moduleId: 10,
        dependencies: [
          { key: 'lazy', absolutePath: '/lazy.js', asyncType: 'async' },
        ],
      },
      { absolutePath: '/lazy.js', moduleId: 11 },
    ]);

    const { pulledFromLocal, pulledFromRemote, missingAbsPaths } =
      expandSegmentsWithCrossRuntimeDeps({
        segmentOutputs: new Map([['seg:a', [[10, 'code:10']]]]),
        localSerializedEntries: local,
        remoteSerializedEntries: [],
        eagerAbsPaths: new Set(),
        moduleIdToAbsPath: new Map([
          [10, '/root.js'],
          [11, '/lazy.js'],
        ]),
      });

    expect(pulledFromLocal).toBe(0);
    expect(pulledFromRemote).toBe(0);
    expect(missingAbsPaths).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mergeSharedSegmentOutputs
// ---------------------------------------------------------------------------

describe('mergeSharedSegmentOutputs', () => {
  const { mergeSharedSegmentOutputs } = require('../unionBuildHelpers');

  it('unions disjoint main/bg module sets for a shared segment', () => {
    // The @ledgerhq / @onekeyfe shape: main reaches a small subset
    // (100, 101), bg drags in the whole transitive chain (200, 201, 202).
    // Emitting only main's view would drop the bg-side modules from the
    // shipped .seg.js and crash bg at runtime.
    const main = [
      [100, 'code:100'],
      [101, 'code:101'],
    ];
    const bg = [
      [200, 'code:200'],
      [201, 'code:201'],
      [202, 'code:202'],
    ];
    const { mergedSegModules, mergedAbsPaths, mergedModuleIdToAbsPath } =
      mergeSharedSegmentOutputs({
        mainSegModules: main,
        backgroundSegModules: bg,
        mainAbsPaths: new Set(['/a.js', '/b.js']),
        backgroundAbsPaths: new Set(['/c.js', '/d.js', '/e.js']),
        mainModuleIdToAbsPath: new Map([
          [100, '/a.js'],
          [101, '/b.js'],
        ]),
        backgroundModuleIdToAbsPath: new Map([
          [200, '/c.js'],
          [201, '/d.js'],
          [202, '/e.js'],
        ]),
      });

    expect(mergedSegModules.map(([id]) => id).toSorted()).toEqual([
      100, 101, 200, 201, 202,
    ]);
    expect([...mergedAbsPaths].toSorted()).toEqual([
      '/a.js',
      '/b.js',
      '/c.js',
      '/d.js',
      '/e.js',
    ]);
    expect(mergedModuleIdToAbsPath.get(100)).toBe('/a.js');
    expect(mergedModuleIdToAbsPath.get(200)).toBe('/c.js');
  });

  it('dedupes by moduleId when both sides carry the same module', () => {
    // If the same absPath is in both graphs, Metro assigns the same
    // moduleId (fileToIdMap is a singleton). The emitted seg must contain
    // the module once, not twice; main's version wins since it's iterated
    // first.
    const shared = [42, '/* main version */'];
    const main = [[41, 'code:41'], shared];
    const bg = [
      [42, '/* bg version */'], // different code, same id → should be skipped
      [43, 'code:43'],
    ];

    const { mergedSegModules } = mergeSharedSegmentOutputs({
      mainSegModules: main,
      backgroundSegModules: bg,
      mainAbsPaths: new Set(),
      backgroundAbsPaths: new Set(),
      mainModuleIdToAbsPath: new Map(),
      backgroundModuleIdToAbsPath: new Map(),
    });

    expect(mergedSegModules.map(([id]) => id)).toEqual([41, 42, 43]);
    // main's 42 entry is preserved, bg's duplicate is dropped.
    const entryForId42 = mergedSegModules.find(([id]) => id === 42);
    expect(entryForId42[1]).toBe('/* main version */');
  });

  it('handles one side being empty or undefined', () => {
    const { mergedSegModules, mergedAbsPaths, mergedModuleIdToAbsPath } =
      mergeSharedSegmentOutputs({
        mainSegModules: undefined,
        backgroundSegModules: [[5, 'c']],
        mainAbsPaths: undefined,
        backgroundAbsPaths: new Set(['/only-bg.js']),
        mainModuleIdToAbsPath: undefined,
        backgroundModuleIdToAbsPath: new Map([[5, '/only-bg.js']]),
      });

    expect(mergedSegModules).toEqual([[5, 'c']]);
    expect([...mergedAbsPaths]).toEqual(['/only-bg.js']);
    expect(mergedModuleIdToAbsPath.get(5)).toBe('/only-bg.js');
  });

  it('prefers main when both runtimes know the same id→path mapping', () => {
    // The two runtimes should agree on fileToIdMap output, but defend
    // against accidental divergence — main is the canonical source since
    // its segment.hbc is deterministic and iterated first downstream.
    const { mergedModuleIdToAbsPath } = mergeSharedSegmentOutputs({
      mainSegModules: [[10, '']],
      backgroundSegModules: [[10, '']],
      mainAbsPaths: new Set(['/main-version.js']),
      backgroundAbsPaths: new Set(['/bg-version.js']),
      mainModuleIdToAbsPath: new Map([[10, '/main-version.js']]),
      backgroundModuleIdToAbsPath: new Map([[10, '/bg-version.js']]),
    });

    expect(mergedModuleIdToAbsPath.get(10)).toBe('/main-version.js');
  });
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

describe('computeSharedPerRuntimeDeps', () => {
  it('returns null when not forceShared (the canShare path requires identical deps)', () => {
    expect(
      computeSharedPerRuntimeDeps({
        mainDeps: new Set(['seg:a']),
        backgroundDeps: new Set(['seg:b']),
        forceShared: false,
      }),
    ).toBeNull();
  });

  it('returns null when forceShared but deps already match (no override needed)', () => {
    expect(
      computeSharedPerRuntimeDeps({
        mainDeps: new Set(['seg:a', 'seg:b']),
        backgroundDeps: new Set(['seg:b', 'seg:a']),
        forceShared: true,
      }),
    ).toBeNull();
  });

  it('emits sorted per-runtime override lists when forceShared deps diverge', () => {
    const result = computeSharedPerRuntimeDeps({
      mainDeps: new Set(['seg:hid', 'seg:common']),
      backgroundDeps: new Set(['seg:rxjs-bg', 'seg:common']),
      forceShared: true,
    });

    expect(result).toEqual({
      mainDependsOn: ['seg:common', 'seg:hid'],
      backgroundDependsOn: ['seg:common', 'seg:rxjs-bg'],
    });
  });

  it('handles one runtime having extra deps the other lacks', () => {
    const result = computeSharedPerRuntimeDeps({
      mainDeps: new Set(['seg:a']),
      backgroundDeps: new Set(['seg:a', 'seg:bg-only']),
      forceShared: true,
    });

    expect(result).toEqual({
      mainDependsOn: ['seg:a'],
      backgroundDependsOn: ['seg:a', 'seg:bg-only'],
    });
  });

  it('handles empty dep sets on either side', () => {
    const result = computeSharedPerRuntimeDeps({
      mainDeps: new Set(),
      backgroundDeps: new Set(['seg:bg-only']),
      forceShared: true,
    });

    expect(result).toEqual({
      mainDependsOn: [],
      backgroundDependsOn: ['seg:bg-only'],
    });
  });

  it('returns null when both sides are empty (still equal)', () => {
    expect(
      computeSharedPerRuntimeDeps({
        mainDeps: new Set(),
        backgroundDeps: new Set(),
        forceShared: true,
      }),
    ).toBeNull();
  });
});
