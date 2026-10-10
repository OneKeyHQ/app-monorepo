import { act, renderHook } from '@testing-library/react-native';

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
  ])('invalidates pending work and closes dialogs on %j', async (next) => {
    const close = jest.fn();
    const { result, rerender } = renderHook(
      (context: typeof initial) =>
        useChartOrderContext({ ...context, onInvalidate: close }),
      { initialProps: initial },
    );
    const generation = result.current.current;
    let resolveMeta: () => void = () => {};
    const metadata = new Promise<void>((resolve) => {
      resolveMeta = resolve;
    });
    const open = jest.fn();
    const pending = metadata.then(() => {
      if (generation === result.current.current) open();
    });
    rerender(next);
    rerender(initial);
    await act(async () => {
      resolveMeta();
      await pending;
    });
    expect(open).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(2);
  });

  it('keeps an unchanged context valid and invalidates it on unmount', () => {
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
    unmount();
    expect(ref.current).not.toBe(generation);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
