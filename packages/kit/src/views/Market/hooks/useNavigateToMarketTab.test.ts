/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { rootNavigationRef, switchTabAsync } from '@onekeyhq/components';
import type { IMarketSelectedTabAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { isMarketNavigationTargetApplied } from './marketNavigationTarget';
import { useNavigateToMarketTab } from './useNavigateToMarketTab';

const mockSetMarketSelectedTab = jest.fn();
let mockMarketSelectedTab: IMarketSelectedTabAtom = { tab: 'trending' };

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: {
      navigate: jest.fn(),
    },
  },
  switchTabAsync: jest.fn(async () => undefined),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketSelectedTabAtom: () => [
    mockMarketSelectedTab,
    mockSetMarketSelectedTab,
  ],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    SwitchDiscoveryTabInNative: 'SwitchDiscoveryTabInNative',
  },
  appEventBus: {
    emit: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isExtensionUiPopup: false,
    isExtensionUiSidePanel: false,
    isNative: true,
  },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      openExtensionExpandTab: jest.fn(),
    },
  },
}));

const mockRootNavigationRef = rootNavigationRef as typeof rootNavigationRef & {
  current: {
    navigate: jest.Mock;
  };
};
const mockSwitchTabAsync = switchTabAsync as jest.MockedFunction<
  typeof switchTabAsync
>;
const mockAppEventBus = appEventBus as typeof appEventBus & {
  emit: jest.Mock;
};

describe('useNavigateToMarketTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockMarketSelectedTab = { tab: 'trending' };
    mockSwitchTabAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for the native atom echo and tab switch before completing', async () => {
    const onNavigationComplete = jest.fn();
    const { result, rerender } = renderHook(() => useNavigateToMarketTab());

    act(() => {
      result.current({
        tabToSelect: 'watchlist',
        onNavigationComplete,
      });
    });

    expect(mockSetMarketSelectedTab).toHaveBeenCalledTimes(1);
    expect(mockSwitchTabAsync).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onNavigationComplete).not.toHaveBeenCalled();

    mockMarketSelectedTab = { tab: 'watchlist' };
    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    expect(mockSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.Discovery);
    expect(mockRootNavigationRef.current.navigate).toHaveBeenCalledWith(
      ERootRoutes.Main,
      {
        screen: ETabRoutes.Discovery,
        params: {
          screen: ETabDiscoveryRoutes.TabDiscovery,
          params: {
            defaultTab: ETranslations.global_market,
          },
        },
      },
    );
    expect(onNavigationComplete).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(149);
    });
    expect(onNavigationComplete).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      EAppEventBusNames.SwitchDiscoveryTabInNative,
      { tab: ETranslations.global_market },
    );
    expect(onNavigationComplete).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender();
      await Promise.resolve();
    });
    expect(mockSwitchTabAsync).toHaveBeenCalledTimes(1);
    expect(onNavigationComplete).toHaveBeenCalledTimes(1);
  });
});

describe('isMarketNavigationTargetApplied', () => {
  it('does not accept a stale selected spot category from another tab', () => {
    expect(
      isMarketNavigationTargetApplied(
        {
          tab: 'watchlist',
          selectedSpotCategory: 'stock',
        },
        {
          tab: 'trending',
          spotCategory: 'stock',
        },
      ),
    ).toBe(false);
  });

  it('accepts the requested spot category after it is fully applied', () => {
    expect(
      isMarketNavigationTargetApplied(
        {
          tab: 'trending',
          selectedSpotCategory: 'stock',
        },
        {
          tab: 'trending',
          spotCategory: 'stock',
        },
      ),
    ).toBe(true);
  });

  it('accepts the requested perps category after it is fully applied', () => {
    expect(
      isMarketNavigationTargetApplied(
        {
          tab: 'perps',
          selectedPerpsCategory: 'all',
        },
        {
          tab: 'perps',
          perpsCategory: 'all',
        },
      ),
    ).toBe(true);
  });

  it('accepts a tab-only target after the tab is applied', () => {
    expect(
      isMarketNavigationTargetApplied(
        {
          tab: 'watchlist',
          selectedSpotCategory: 'stock',
        },
        {
          tab: 'watchlist',
        },
      ),
    ).toBe(true);
  });
});
