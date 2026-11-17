import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

import { transformFileSync } from '@babel/core';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

import type {
  ITradingViewNativeSubIndicatorRenderPane,
  ITradingViewNativeSubIndicatorValueRange,
} from './types';

const SUB_INDICATOR_RENDER_DIRECTORY = __dirname;
const RANGE_MODULE_PATH = path.join(SUB_INDICATOR_RENDER_DIRECTORY, 'range.ts');

function getProductionSourcePaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return getProductionSourcePaths(entryPath);
    }
    return entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts')
      ? [entryPath]
      : [];
  });
}

function loadWorkletsTransformedRange() {
  const transformed = transformFileSync(RANGE_MODULE_PATH, {
    babelrc: false,
    compact: true,
    configFile: false,
    plugins: ['react-native-worklets/plugin'],
    presets: [
      [
        '@babel/preset-env',
        { modules: 'commonjs', targets: { node: 'current' } },
      ],
      ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
    ],
  });
  assert(transformed?.code, 'Failed to transform the production range module');

  const transformedModule: {
    exports: Record<string, unknown>;
  } = { exports: {} };
  runInNewContext(
    transformed.code,
    {
      exports: transformedModule.exports,
      global: { Error },
      module: transformedModule,
    },
    { filename: RANGE_MODULE_PATH },
  );

  return transformedModule.exports
    .getTradingViewNativeSubIndicatorValueRange as (options: {
    endIndex: number;
    pane: ITradingViewNativeSubIndicatorRenderPane;
    startIndex: number;
  }) => ITradingViewNativeSubIndicatorValueRange | null;
}

function createAutoRangePane(): ITradingViewNativeSubIndicatorRenderPane {
  return {
    bands: [],
    fills: [],
    format: { precision: 2, type: 'price' },
    indicator: 'RSI',
    inputValues: {},
    instanceId: 'worklet-range-test',
    isVisible: true,
    key: 'subIndicator.worklet-range-test.pane',
    scale: {
      includeValues: [],
      kind: 'auto',
      padding: { bottomRatio: 0, topRatio: 0 },
    },
    series: [
      {
        id: 'value',
        key: 'subIndicator.worklet-range-test.plot.value',
        style: {
          baseline: 0,
          color: '#2196F3',
          joinPoints: false,
          lineStyle: 'solid',
          lineWidth: 1,
          transparency: 0,
          type: 'line',
          visible: true,
        },
        title: 'Value',
        values: [2, 10],
        zOrder: 10,
      },
    ],
    shortTitle: 'RSI',
    title: 'Relative Strength Index',
  };
}

describe('TradingViewNative sub-indicator Worklets transforms', () => {
  it('preserves auto-range accumulation after transforming production code', () => {
    const getRange = loadWorkletsTransformedRange();

    expect(
      getRange({
        endIndex: 2,
        pane: createAutoRangePane(),
        startIndex: 0,
      }),
    ).toEqual({ maxValue: 10, minValue: 2 });
  });

  it('keeps Worklet directives at the top function level', () => {
    const nestedWorklets: string[] = [];

    for (const sourcePath of getProductionSourcePaths(
      SUB_INDICATOR_RENDER_DIRECTORY,
    )) {
      const source = readFileSync(sourcePath, 'utf8');
      const ast = parse(source, {
        plugins: ['typescript'],
        sourceFilename: sourcePath,
        sourceType: 'module',
      });

      traverse(ast, {
        Function(functionPath) {
          if (
            functionPath.node.body.type !== 'BlockStatement' ||
            !functionPath.node.body.directives.some(
              (directive) => directive.value.value === 'worklet',
            ) ||
            !functionPath.findParent((parentPath) => parentPath.isFunction())
          ) {
            return;
          }

          const relativePath = path.relative(
            SUB_INDICATOR_RENDER_DIRECTORY,
            sourcePath,
          );
          nestedWorklets.push(
            `${relativePath}:${functionPath.node.loc?.start.line ?? 0}`,
          );
        },
      });
    }

    expect(nestedWorklets).toEqual([]);
  });
});
