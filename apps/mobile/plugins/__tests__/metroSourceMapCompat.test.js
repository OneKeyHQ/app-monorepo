const {
  isSourceMapModule,
  normalizeMap,
  normalizeModulesForSourceMap,
} = require('../metroSourceMapCompat');

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
    expect(isSourceMapModule(module)).toBe(true);
  });

  test('converts non-standard full maps to an empty raw mapping', () => {
    expect(normalizeMap({ mappings: [] })).toEqual([]);
  });

  test('does not treat asset modules as JavaScript source map inputs', () => {
    expect(
      isSourceMapModule({
        output: [{ type: 'js/module/asset', data: { map: {} } }],
      }),
    ).toBe(false);
  });
});
