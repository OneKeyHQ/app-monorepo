import assert from 'node:assert';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

import { transformFileSync } from '@babel/core';

import type { getTradingViewNativePanOffsetBounds } from './chartViewport';

type IPanOffsetBounds = typeof getTradingViewNativePanOffsetBounds;
type IWorkletClosure = Record<string, unknown>;

function loadPanBoundsWorklet(): IPanOffsetBounds {
  const modulePath = path.join(__dirname, 'chartViewport.ts');
  const transformed = transformFileSync(modulePath, {
    babelrc: false,
    compact: true,
    configFile: false,
    plugins: ['react-native-worklets/plugin'],
    presets: [
      [
        '@babel/preset-env',
        { modules: 'commonjs', targets: { node: 'current' } },
      ],
      ['@babel/preset-typescript', { allExtensions: true }],
    ],
  });
  assert(transformed?.code, 'Failed to transform the viewport module');
  const transformedModule: { exports: Record<string, unknown> } = {
    exports: {},
  };
  runInNewContext(transformed.code, {
    exports: transformedModule.exports,
    global: { Error },
    module: transformedModule,
    require: jest.requireActual,
  });
  const serialized = transformedModule.exports
    .getTradingViewNativePanOffsetBounds as {
    __closure: IWorkletClosure;
    __initData: { code: string };
  };
  // The UI runtime receives serialized code and its closure, not module globals.
  const worklet = runInNewContext(`(${serialized.__initData.code})`) as (
    this: { __closure: IWorkletClosure },
    options: Parameters<IPanOffsetBounds>[0],
  ) => ReturnType<IPanOffsetBounds>;
  return worklet.bind({ __closure: serialized.__closure });
}

describe('TradingViewNative pan bounds on the UI runtime', () => {
  it('captures the default candle gap when the worklet is serialized', () => {
    const getBounds = loadPanBoundsWorklet();
    expect(
      getBounds({ chartWidth: 100, pointCount: 20, zoomScale: 1 }),
    ).toEqual({
      minOffset: -94,
      maxOffset: 115,
    });
    expect(
      getBounds({
        candleGap: 3,
        chartWidth: 100,
        pointCount: 20,
        zoomScale: 1,
      }),
    ).toEqual({
      minOffset: -92,
      maxOffset: 155,
    });
  });
});
