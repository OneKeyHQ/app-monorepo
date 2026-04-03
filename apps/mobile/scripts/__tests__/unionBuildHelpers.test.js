const {
  buildGraphModuleIndex,
  buildModuleSignature,
  buildRuntimeOwnership,
  createSerializedModuleToSegmentMap,
  rewriteAsyncRequirePaths,
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

  it('rewrites async require paths with runtime-local segment targets', () => {
    const mainWrappedModules = [[1, 'module.exports={"101":"old-path"};']];
    const backgroundWrappedModules = [
      [1, 'module.exports={"101":"old-path"};'],
    ];

    rewriteAsyncRequirePaths(
      mainWrappedModules,
      new Map([[101, 'seg:proxy.main']]),
    );
    rewriteAsyncRequirePaths(
      backgroundWrappedModules,
      new Map([[101, 'seg:proxy.background']]),
    );

    expect(mainWrappedModules[0][1]).toContain('"101":"seg:proxy.main"');
    expect(backgroundWrappedModules[0][1]).toContain(
      '"101":"seg:proxy.background"',
    );
  });
});
