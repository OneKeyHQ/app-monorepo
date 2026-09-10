/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';

import { useTradingViewNativeChartComponents } from './useTradingViewNativeChartComponents';

import type {
  ITradingViewNativeChartComponentNode,
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativeReferenceLineComponent,
} from './types';

const CUSTOM_REFERENCE_LINE: ITradingViewNativeReferenceLineComponent = {
  id: 'custom.referenceLine',
  props: {
    anchor: { price: 50, type: 'price' },
    color: '#custom',
    interactive: false,
    style: 'solid',
    title: 'Custom',
  },
  type: 'referenceLine',
};
const CUSTOM_COMPONENT_TREE: readonly ITradingViewNativeChartComponentNode[] = [
  {
    children: [CUSTOM_REFERENCE_LINE],
    id: 'custom.group',
    type: 'group',
  },
];

function getReferenceLine(
  components: readonly ITradingViewNativeChartLeafComponent[],
  id: string,
) {
  return components.find(
    (component): component is ITradingViewNativeReferenceLineComponent =>
      component.type === 'referenceLine' && component.id === id,
  );
}

describe('useTradingViewNativeChartComponents', () => {
  it('captures the first finite price for each data source', () => {
    const { result, rerender } = renderHook(
      ({
        dataProviderKey,
        latestPrice,
        referenceLineColor,
        showPreviousClose,
      }) =>
        useTradingViewNativeChartComponents({
          chartComponents: CUSTOM_COMPONENT_TREE,
          dataProviderKey,
          latestPrice,
          referenceLineColor,
          showPreviousClose,
        }),
      {
        initialProps: {
          dataProviderKey: 'source-a',
          latestPrice: 100,
          referenceLineColor: '#initial',
          showPreviousClose: true,
        },
      },
    );

    expect(result.current.map((component) => component.id)).toEqual([
      'system.initialPriceReferenceLine',
      'custom.referenceLine',
    ]);
    expect(
      getReferenceLine(result.current, 'system.initialPriceReferenceLine')
        ?.props,
    ).toEqual({
      anchor: { price: 100, type: 'price' },
      color: '#initial',
      interactive: false,
      style: 'dashed',
      title: 'Prev close',
    });

    rerender({
      dataProviderKey: 'source-a',
      latestPrice: 120,
      referenceLineColor: '#updated',
      showPreviousClose: true,
    });

    expect(
      getReferenceLine(result.current, 'system.initialPriceReferenceLine')
        ?.props,
    ).toMatchObject({
      anchor: { price: 100 },
      color: '#updated',
    });

    rerender({
      dataProviderKey: 'source-b',
      latestPrice: 200,
      referenceLineColor: '#updated',
      showPreviousClose: true,
    });

    expect(
      getReferenceLine(result.current, 'system.initialPriceReferenceLine')
        ?.props.anchor.price,
    ).toBe(200);

    rerender({
      dataProviderKey: 'source-without-data',
      latestPrice: Number.NaN,
      referenceLineColor: '#updated',
      showPreviousClose: true,
    });
    rerender({
      dataProviderKey: 'source-a',
      latestPrice: 300,
      referenceLineColor: '#updated',
      showPreviousClose: true,
    });

    expect(
      getReferenceLine(result.current, 'system.initialPriceReferenceLine')
        ?.props.anchor.price,
    ).toBe(300);
  });

  it('waits for a finite price without hiding custom components', () => {
    const { result, rerender } = renderHook(
      ({ latestPrice }) =>
        useTradingViewNativeChartComponents({
          chartComponents: CUSTOM_COMPONENT_TREE,
          dataProviderKey: 'source-a',
          latestPrice,
          referenceLineColor: '#initial',
          showPreviousClose: true,
        }),
      { initialProps: { latestPrice: Number.NaN } },
    );

    expect(result.current).toEqual([CUSTOM_REFERENCE_LINE]);

    rerender({ latestPrice: 100 });

    expect(result.current[0]?.id).toBe('system.initialPriceReferenceLine');
  });

  it('anchors the reference line on the reported previous close', () => {
    const { result, rerender } = renderHook(
      ({ latestPrice, previousClose }) =>
        useTradingViewNativeChartComponents({
          chartComponents: CUSTOM_COMPONENT_TREE,
          dataProviderKey: 'source-a',
          latestPrice,
          previousClose,
          referenceLineColor: '#initial',
          showPreviousClose: true,
        }),
      {
        initialProps: {
          latestPrice: 100,
          previousClose: 95.5 as number | undefined,
        },
      },
    );

    expect(
      getReferenceLine(result.current, 'system.initialPriceReferenceLine')
        ?.props.anchor.price,
    ).toBe(95.5);

    // The quote refreshes while the captured first price stays at 100.
    rerender({ latestPrice: 120, previousClose: 96 });

    expect(
      getReferenceLine(result.current, 'system.initialPriceReferenceLine')
        ?.props.anchor.price,
    ).toBe(96);

    // Losing the figure falls back to the captured first price, and a
    // non-finite figure is treated as missing.
    rerender({ latestPrice: 120, previousClose: undefined });

    expect(
      getReferenceLine(result.current, 'system.initialPriceReferenceLine')
        ?.props.anchor.price,
    ).toBe(100);

    rerender({ latestPrice: 120, previousClose: Number.NaN });

    expect(
      getReferenceLine(result.current, 'system.initialPriceReferenceLine')
        ?.props.anchor.price,
    ).toBe(100);
  });

  it('keeps the previous close hidden until enabled', () => {
    const { result, rerender } = renderHook(
      ({ latestPrice, showPreviousClose }) =>
        useTradingViewNativeChartComponents({
          chartComponents: CUSTOM_COMPONENT_TREE,
          dataProviderKey: 'source-a',
          latestPrice,
          referenceLineColor: '#initial',
          showPreviousClose,
        }),
      {
        initialProps: {
          latestPrice: 100,
          showPreviousClose: false,
        },
      },
    );

    expect(result.current).toEqual([CUSTOM_REFERENCE_LINE]);

    rerender({ latestPrice: 120, showPreviousClose: false });
    rerender({ latestPrice: 120, showPreviousClose: true });

    expect(
      getReferenceLine(result.current, 'system.initialPriceReferenceLine')
        ?.props.anchor.price,
    ).toBe(100);
  });
});
