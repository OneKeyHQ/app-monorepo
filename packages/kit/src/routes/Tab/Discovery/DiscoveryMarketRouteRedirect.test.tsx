/** @jest-environment jsdom */
import { render } from '@testing-library/react';

import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { DiscoveryMarketRouteRedirect } from './DiscoveryMarketRouteRedirect';

const mockGoBack = jest.fn();
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
          } as never
        }
      />,
    );

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketDetailV2,
        params: { marketTokenId: 'bitcoin', network: 'btc' },
      },
    });
  });

  it('does not call goBack when the legacy route is at index 0 of the Discovery stack even if a parent navigator can go back', () => {
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
          } as never
        }
      />,
    );

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketDetailV2,
        params: { marketTokenId: 'ethereum', network: 'eth' },
      },
    });
  });

  it('forwards MarketBannerDetail without goBack when Discovery cannot pop', () => {
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
          } as never
        }
      />,
    );

    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketBannerDetail,
        params: { tokenListId: 'featured', title: 'Featured' },
      },
    });
  });
});
