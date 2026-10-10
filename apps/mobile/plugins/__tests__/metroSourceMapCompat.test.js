const path = require('path');

const {
  normalizeMap,
  normalizeModulesForSourceMap,
} = require('../metroSourceMapCompat');

const baseJSBundle = require(
  path.resolve(
    __dirname,
    '../../../../node_modules',
    'metro/src/DeltaBundler/Serializers/baseJSBundle',
  ),
).default;
const bundleToString = require(
  path.resolve(
    __dirname,
    '../../../../node_modules',
    'metro/src/lib/bundleToString',
  ),
).default;
const { sourceMapStringNonBlocking } = require(
  path.resolve(
    __dirname,
    '../../../../node_modules',
    'metro/src/DeltaBundler/Serializers/sourceMapString',
  ),
);
// Decode with the same source-map release that metro-source-map uses.
const { SourceMapConsumer } = require(
  require.resolve('source-map', {
    paths: [path.dirname(require.resolve('metro-source-map'))],
  }),
);

const createGraphModule = (filePath, type, code, map) => ({
  dependencies: new Map(),
  getSource: () => Buffer.from(code),
  output: [
    {
      type,
      data: {
        code,
        functionMap: null,
        lineCount: code.split('\n').length,
        map,
      },
    },
  ],
  path: filePath,
});

describe('metro source map compatibility', () => {
  test('converts full source maps to Metro raw mapping tuples', () => {
    const map = {
      version: 3,
      names: ['value'],
      sources: ['example.ts'],
      mappings: 'AAAAA,QAASA',
    };

    expect(normalizeMap(map)).toEqual([
      [1, 0, 1, 0, 'value'],
      [1, 8, 1, 9, 'value'],
    ]);
  });

  test('normalizes module output maps without dropping the module', () => {
    const module = {
      output: [
        {
          type: 'js/module',
          data: {
            code: 'const value = 1;',
            map: {
              version: 3,
              names: [],
              sources: ['example.ts'],
              mappings: 'AAAA',
            },
          },
        },
      ],
    };

    expect(normalizeModulesForSourceMap([module])).toEqual([module]);
    expect(Array.isArray(module.output[0].data.map)).toBe(true);
  });

  test('converts non-standard full maps to an empty raw mapping', () => {
    expect(normalizeMap({ mappings: [] })).toEqual([]);
  });

  test('maps modules after an asset module to their bundled lines', async () => {
    const lastModulePath = '/repo/packages/kit/src/last.ts';
    const modules = normalizeModulesForSourceMap([
      createGraphModule(
        '/repo/packages/shared/src/locale/json/bn.json',
        'js/module',
        '__d(function jsonModule() {\n  module.exports = {};\n});',
        { version: 3, names: [], sources: ['bn.json'], mappings: 'AAAA;AACA' },
      ),
      createGraphModule(
        '/repo/packages/kit/assets/logo.png',
        'js/module/asset',
        '__d(function assetModule() {\n  module.exports = { name: "logo" };\n});',
        [[1, 0, 1, 0]],
      ),
      createGraphModule(
        lastModulePath,
        'js/module',
        '__d(function lastModule() {\n  return 3;\n});',
        [
          [1, 0, 1, 0],
          [2, 2, 2, 2],
        ],
      ),
    ]);
    const moduleIds = new Map(
      modules.map((module, index) => [module.path, index + 1]),
    );
    // Same pipeline as segmentSerializer: baseJSBundle decides which modules
    // reach the bundle code, and the map must cover exactly those modules.
    const bundle = baseJSBundle(
      modules[0].path,
      [],
      { dependencies: new Map(modules.map((module) => [module.path, module])) },
      {
        createModuleId: (filePath) => moduleIds.get(filePath),
        dev: false,
        includeAsyncPaths: false,
        modulesOnly: true,
        processModuleFilter: () => true,
        projectRoot: '/repo',
        runModule: false,
        serverRoot: '/repo',
      },
    );
    const { code } = bundleToString(bundle);
    const map = await sourceMapStringNonBlocking(modules, {
      excludeSource: false,
      processModuleFilter: () => true,
      shouldAddToIgnoreList: () => false,
      getSourceUrl: (module) => module.path,
    });

    const lastModuleLine =
      code.split('\n').findIndex((line) => line.includes('lastModule')) + 1;
    const consumer = new SourceMapConsumer(JSON.parse(map));
    const lastModuleMappings = [];
    consumer.eachMapping((mapping) => {
      if (mapping.source === lastModulePath) {
        lastModuleMappings.push(mapping);
      }
    });

    expect(code).toContain('assetModule');
    expect(lastModuleLine).toBe(7);
    expect(lastModuleMappings[0]).toMatchObject({
      generatedLine: lastModuleLine,
      generatedColumn: 0,
      originalLine: 1,
      originalColumn: 0,
    });
    expect(
      consumer.originalPositionFor({ line: lastModuleLine, column: 0 }),
    ).toMatchObject({ source: lastModulePath, line: 1, column: 0 });
  });
});
