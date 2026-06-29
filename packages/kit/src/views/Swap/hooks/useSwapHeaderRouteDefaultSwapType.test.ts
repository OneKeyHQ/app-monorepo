import { renderHook } from '@testing-library/react-native';

import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { useSwapHeaderRouteDefaultSwapType } from './useSwapHeaderRouteDefaultSwapType';

describe('useSwapHeaderRouteDefaultSwapType', () => {
  it('provides the same route default only once', () => {
    const { result, rerender } = renderHook(
      ({
        routeDefaultSwapType,
      }: {
        routeDefaultSwapType?: ESwapTabSwitchType;
      }) => useSwapHeaderRouteDefaultSwapType(routeDefaultSwapType),
      {
        initialProps: {
          routeDefaultSwapType: ESwapTabSwitchType.SWAP,
        },
      },
    );

    expect(result.current).toBe(ESwapTabSwitchType.SWAP);

    rerender({
      routeDefaultSwapType: ESwapTabSwitchType.SWAP,
    });

    expect(result.current).toBeUndefined();
  });

  it('provides a new default when the route default changes', () => {
    const { result, rerender } = renderHook(
      ({
        routeDefaultSwapType,
      }: {
        routeDefaultSwapType?: ESwapTabSwitchType;
      }) => useSwapHeaderRouteDefaultSwapType(routeDefaultSwapType),
      {
        initialProps: {
          routeDefaultSwapType: ESwapTabSwitchType.SWAP,
        },
      },
    );

    expect(result.current).toBe(ESwapTabSwitchType.SWAP);

    rerender({
      routeDefaultSwapType: ESwapTabSwitchType.SWAP,
    });
    expect(result.current).toBeUndefined();

    rerender({
      routeDefaultSwapType: ESwapTabSwitchType.STOCK,
    });
    expect(result.current).toBe(ESwapTabSwitchType.STOCK);
  });

  it('does not provide a default when the route has no default tab', () => {
    const { result, rerender } = renderHook(
      ({
        routeDefaultSwapType,
      }: {
        routeDefaultSwapType?: ESwapTabSwitchType;
      }) => useSwapHeaderRouteDefaultSwapType(routeDefaultSwapType),
      {
        initialProps: {
          routeDefaultSwapType: undefined,
        },
      },
    );

    expect(result.current).toBeUndefined();

    rerender({
      routeDefaultSwapType: undefined,
    });

    expect(result.current).toBeUndefined();
  });
});
