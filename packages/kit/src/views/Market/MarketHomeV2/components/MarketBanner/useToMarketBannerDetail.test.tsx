/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EMarketBannerType,
  type IMarketBannerItem,
} from '@onekeyhq/shared/types/marketV2';

import { EModalMarketRoutes } from '../../../router/types';

import { useToMarketBannerDetail } from './useToMarketBannerDetail';

const mockNavigationPush = jest.fn();
const mockNavigationPushModal = jest.fn();
let mockIsTabletMainView = false;

jest.mock('@onekeyhq/components', () => ({
  useSplitMainView: () => mockIsTabletMainView,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    push: mockNavigationPush,
    pushModal: mockNavigationPushModal,
  }),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      banner: {
        dexBannerEnter: jest.fn(),
      },
    },
  },
}));

function makeBanner(): IMarketBannerItem {
  return {
    _id: 'banner',
    title: 'Robinhood Eco',
    rank: 1,
    mode: 4,
    payload: '',
    miniBundlerVersion: '',
    backgroundColor: 'bg/subdued',
    tokenListId: 'theme-list',
    type: EMarketBannerType.Ticker,
    tokens: [],
  };
}

describe('useToMarketBannerDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTabletMainView = false;
  });

  it('pushes the banner page in a single-pane navigator', () => {
    const banner = makeBanner();
    const { result } = renderHook(() => useToMarketBannerDetail());

    act(() => {
      result.current(banner);
    });

    expect(mockNavigationPush).toHaveBeenCalledWith(
      'MarketBannerDetail',
      expect.objectContaining({
        tokenListId: banner.tokenListId,
        title: banner.title,
        type: banner.type,
      }),
    );
    expect(mockNavigationPushModal).not.toHaveBeenCalled();
  });

  it('uses the registered Market modal stack from the split main pane', () => {
    mockIsTabletMainView = true;
    const banner = makeBanner();
    const { result } = renderHook(() => useToMarketBannerDetail());

    act(() => {
      result.current(banner);
    });

    expect(mockNavigationPushModal).toHaveBeenCalledWith(
      EModalRoutes.MarketModal,
      {
        screen: EModalMarketRoutes.MarketBannerDetail,
        params: expect.objectContaining({
          tokenListId: banner.tokenListId,
          title: banner.title,
          type: banner.type,
        }),
      },
    );
    expect(mockNavigationPush).not.toHaveBeenCalled();
  });
});
