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
  it('draws the previous close line above the custom components', () => {
    const { result, rerender } = renderHook(
      ({ previousClose, referenceLineColor }) =>
        useTradingViewNativeChartComponents({
          chartComponents: CUSTOM_COMPONENT_TREE,
          previousClose,
          referenceLineColor,
          showPreviousClose: true,
        }),
      {
        initialProps: {
          previousClose: 95.5 as number | undefined,
          referenceLineColor: '#initial',
        },
      },
    );

    expect(result.current.map((component) => component.id)).toEqual([
      'system.previousCloseReferenceLine',
      'custom.referenceLine',
    ]);
    expect(
      getReferenceLine(result.current, 'system.previousCloseReferenceLine')
        ?.props,
    ).toEqual({
      anchor: { price: 95.5, type: 'price' },
      color: '#initial',
      interactive: false,
      style: 'dashed',
      title: 'Prev close',
    });

    // The quote refreshes with a new close.
    rerender({ previousClose: 96, referenceLineColor: '#updated' });

    expect(
      getReferenceLine(result.current, 'system.previousCloseReferenceLine')
        ?.props,
    ).toMatchObject({
      anchor: { price: 96 },
      color: '#updated',
    });
  });

  it('never labels a missing close, and keeps custom components', () => {
    const { result, rerender } = renderHook(
      ({ previousClose }) =>
        useTradingViewNativeChartComponents({
          chartComponents: CUSTOM_COMPONENT_TREE,
          previousClose,
          referenceLineColor: '#initial',
          showPreviousClose: true,
        }),
      { initialProps: { previousClose: undefined as number | undefined } },
    );

    expect(result.current).toEqual([CUSTOM_REFERENCE_LINE]);

    rerender({ previousClose: Number.NaN });

    expect(result.current).toEqual([CUSTOM_REFERENCE_LINE]);

    rerender({ previousClose: 100 });

    expect(result.current[0]?.id).toBe('system.previousCloseReferenceLine');

    // Losing the figure again drops the line instead of standing in for it.
    rerender({ previousClose: undefined });

    expect(result.current).toEqual([CUSTOM_REFERENCE_LINE]);
  });

  it('keeps the previous close hidden until enabled', () => {
    const { result, rerender } = renderHook(
      ({ showPreviousClose }) =>
        useTradingViewNativeChartComponents({
          chartComponents: CUSTOM_COMPONENT_TREE,
          previousClose: 100,
          referenceLineColor: '#initial',
          showPreviousClose,
        }),
      { initialProps: { showPreviousClose: false } },
    );

    expect(result.current).toEqual([CUSTOM_REFERENCE_LINE]);

    rerender({ showPreviousClose: true });

    expect(
      getReferenceLine(result.current, 'system.previousCloseReferenceLine')
        ?.props.anchor.price,
    ).toBe(100);
  });
});
