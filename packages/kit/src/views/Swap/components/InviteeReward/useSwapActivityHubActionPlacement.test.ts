/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react-native';

jest.mock('jotai', () => ({
  useAtomValue: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  swapTypeSwitchAtom: jest.fn(() => 'swapTypeSwitchAtom'),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore', () => ({
  jotaiContextStore: {
    prepareStoreForImmediateUse: jest.fn(() => ({})),
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: {
    swap: 'swap',
  },
}));

import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { useSwapActivityHubActionPlacement } from './useSwapActivityHubActionPlacement';

function getUseAtomValueMock() {
  return jest.requireMock('jotai').useAtomValue as jest.Mock;
}

describe('useSwapActivityHubActionPlacement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the route until the store hydrates, then follows live store changes', () => {
    const useAtomValueMock = getUseAtomValueMock();
    useAtomValueMock.mockReturnValue(ESwapTabSwitchType.SWAP);

    const { result, rerender } = renderHook(
      ({ routeSwapType }: { routeSwapType?: ESwapTabSwitchType }) =>
        useSwapActivityHubActionPlacement({
          isDesktop: true,
          isMediumLayout: false,
          routeSwapType,
        }),
      {
        initialProps: {
          routeSwapType: ESwapTabSwitchType.LIMIT,
        },
      },
    );

    expect(result.current).toBe('hidden');

    act(() => {
      useAtomValueMock.mockReturnValue(ESwapTabSwitchType.LIMIT);
      rerender({ routeSwapType: ESwapTabSwitchType.LIMIT });
    });

    act(() => {
      useAtomValueMock.mockReturnValue(ESwapTabSwitchType.SWAP);
      rerender({ routeSwapType: ESwapTabSwitchType.LIMIT });
    });

    expect(result.current).toBe('desktopHeader');
  });

  it('applies a new route immediately while its store update is pending', () => {
    const useAtomValueMock = getUseAtomValueMock();
    useAtomValueMock.mockReturnValue(ESwapTabSwitchType.SWAP);

    const { result, rerender } = renderHook(
      ({ routeSwapType }: { routeSwapType?: ESwapTabSwitchType }) =>
        useSwapActivityHubActionPlacement({
          isDesktop: true,
          isMediumLayout: false,
          routeSwapType,
        }),
      {
        initialProps: {
          routeSwapType: ESwapTabSwitchType.SWAP,
        },
      },
    );

    expect(result.current).toBe('desktopHeader');

    act(() => {
      rerender({ routeSwapType: ESwapTabSwitchType.STOCK });
    });

    expect(result.current).toBe('hidden');
  });
});
