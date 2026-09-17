import {
  flattenTradingViewNativeChartComponentTree,
  getTradingViewNativeChartComponentPriceAxisLabel,
} from './chartComponentTree';

import type { ITradingViewNativeChartComponentNode } from '../types';

function createReferenceLine(
  id: string,
  price: number,
): ITradingViewNativeChartComponentNode {
  return {
    id,
    props: {
      anchor: { price, type: 'price' },
      color: '#888888',
      interactive: false,
      style: 'dashed',
      title: id,
    },
    type: 'referenceLine',
  };
}

describe('TradingViewNative chart component tree', () => {
  it('flattens nested groups without changing component order', () => {
    const components: readonly ITradingViewNativeChartComponentNode[] = [
      createReferenceLine('first', 1),
      {
        id: 'nested-group',
        type: 'group',
        children: [
          createReferenceLine('second', 2),
          {
            id: 'deep-group',
            type: 'group',
            children: [createReferenceLine('third', 3)],
          },
        ],
      },
    ];

    expect(
      flattenTradingViewNativeChartComponentTree(components).map(
        (component) => component.id,
      ),
    ).toEqual(['first', 'second', 'third']);
  });

  it('returns the widest finite component price label', () => {
    const components = flattenTradingViewNativeChartComponentTree([
      createReferenceLine('small', 1),
      createReferenceLine('large', 123_456),
      createReferenceLine('invalid', Number.NaN),
    ]);

    expect(getTradingViewNativeChartComponentPriceAxisLabel(components)).toBe(
      '123456.00',
    );
  });
});
