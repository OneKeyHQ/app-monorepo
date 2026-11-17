/** @jest-environment jsdom */
import { render } from '@testing-library/react';

import {
  ERootRoutes,
  ETabDiscoveryRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { DiscoveryMarketRouteRedirect } from './DiscoveryMarketRouteRedirect';

const mockGoBack = jest.fn();
const mockDispatch = jest.fn();
const replaceWithDiscoveryHome = {
  type: 'REPLACE',
  payload: { name: ETabDiscoveryRoutes.TabDiscovery },
};
const mockNavigate = jest.fn();

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    navigate: mockNavigate,
  }),
}));

describe('DiscoveryMarketRouteRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pops the Discovery stack and forwards MarketDetailV2 to the standalone Market tab when the Discovery stack has back history', () => {
    render(
      <DiscoveryMarketRouteRedirect
        route={
          {
            key: 'detail-1',
            name: ETabMarketRoutes.MarketDetailV2,
            params: { marketTokenId: 'bitcoin', network: 'btc' },
          } as never
        }
        navigation={
          {
            getState: () => ({ index: 1 }),
            canGoBack: () => true,
            goBack: mockGoBack,
            dispatch: mockDispatch,
          } as never
        }
      />,
    );

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketDetailV2,
        params: { marketTokenId: 'bitcoin', network: 'btc' },
      },
    });
  });

  it('replaces the Discovery root with TabDiscovery instead of popping parent history when the legacy route is at index 0', () => {
    render(
      <DiscoveryMarketRouteRedirect
        route={
          {
            key: 'detail-root',
            name: ETabMarketRoutes.MarketDetailV2,
            params: { marketTokenId: 'ethereum', network: 'eth' },
          } as never
        }
        navigation={
          {
            getState: () => ({ index: 0 }),
            canGoBack: () => true,
            goBack: mockGoBack,
            dispatch: mockDispatch,
          } as never
        }
      />,
    );

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining(replaceWithDiscoveryHome),
    );
    expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketDetailV2,
        params: { marketTokenId: 'ethereum', network: 'eth' },
      },
    });
  });

  it('forwards MarketBannerDetail and restores the Discovery home when Discovery cannot pop', () => {
    render(
      <DiscoveryMarketRouteRedirect
        route={
          {
            key: 'banner-1',
            name: ETabMarketRoutes.MarketBannerDetail,
            params: { tokenListId: 'featured', title: 'Featured' },
          } as never
        }
        navigation={
          {
            getState: () => ({ index: 0 }),
            canGoBack: () => false,
            goBack: mockGoBack,
            dispatch: mockDispatch,
          } as never
        }
      />,
    );

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining(replaceWithDiscoveryHome),
    );
    expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketBannerDetail,
        params: { tokenListId: 'featured', title: 'Featured' },
      },
    });
  });
});
