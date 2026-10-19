import { renderHook } from '@testing-library/react-native';

import { useChartOrderContext } from './useChartOrderContext';

const initial = {
  accountAddress: '0xaaa',
  symbol: 'BTC',
  chartInstanceKey: 'first',
};

describe('chart order context', () => {
  it.each([
    { ...initial, accountAddress: '0xbbb' },
    { ...initial, symbol: 'ETH' },
    { ...initial, chartInstanceKey: 'second' },
  ])('invalidates the captured context and closes dialogs on %j', (next) => {
    const close = jest.fn();
    const { result, rerender, unmount } = renderHook(
      (context: typeof initial) =>
        useChartOrderContext({ ...context, onInvalidate: close }),
      { initialProps: initial },
    );
    const ref = result.current;
    const generation = ref.current;
    rerender({ ...initial });
    expect(ref.current).toBe(generation);
    expect(close).not.toHaveBeenCalled();
    rerender(next);
    expect(ref.current).not.toBe(generation);
    rerender(initial);
    expect(ref.current).not.toBe(generation);
    expect(close).toHaveBeenCalledTimes(2);
    const beforeUnmount = ref.current;
    unmount();
    expect(ref.current).not.toBe(beforeUnmount);
    expect(close).toHaveBeenCalledTimes(3);
  });
});
