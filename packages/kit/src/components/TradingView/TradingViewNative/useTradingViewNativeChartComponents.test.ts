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
  return components.find((component) => component.id === id);
}

describe('useTradingViewNativeChartComponents', () => {
  it('captures the first finite price for each data source', () => {
    const { result, rerender } = renderHook(
      ({ dataProviderKey, latestPrice, referenceLineColor }) =>
        useTradingViewNativeChartComponents({
          chartComponents: CUSTOM_COMPONENT_TREE,
          dataProviderKey,
          latestPrice,
          referenceLineColor,
        }),
      {
        initialProps: {
          dataProviderKey: 'source-a',
          latestPrice: 100,
          referenceLineColor: '#initial',
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
    });

    expect(
      getReferenceLine(result.current, 'system.initialPriceReferenceLine')
        ?.props.anchor.price,
    ).toBe(200);

    rerender({
      dataProviderKey: 'source-without-data',
      latestPrice: Number.NaN,
      referenceLineColor: '#updated',
    });
    rerender({
      dataProviderKey: 'source-a',
      latestPrice: 300,
      referenceLineColor: '#updated',
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
        }),
      { initialProps: { latestPrice: Number.NaN } },
    );

    expect(result.current).toEqual([CUSTOM_REFERENCE_LINE]);

    rerender({ latestPrice: 100 });

    expect(result.current[0]?.id).toBe('system.initialPriceReferenceLine');
  });
});
