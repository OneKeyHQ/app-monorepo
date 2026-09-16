/** @jest-environment jsdom */

import type { ComponentProps } from 'react';
import { useEffect } from 'react';

import { render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';

import { createMarketDetailV2Route } from './MarketDetailV2Route';

type IRouteProps = ComponentProps<ReturnType<typeof createMarketDetailV2Route>>;

const mockLazyMounts = { mounted: 0, unmounted: 0 };
const mockDirectMounts = { mounted: 0, unmounted: 0 };
let mockPreloadedComponent:
  | ((props: {
      route: { params: { tokenAddress: string } };
    }) => React.ReactNode)
  | undefined;

jest.mock('../../../components/LazyLoadPage', () => ({
  LazyLoadPage: () =>
    function MockLazyRoute(props: {
      route: { params: { tokenAddress: string } };
    }) {
      useEffect(() => {
        mockLazyMounts.mounted += 1;
        return () => {
          mockLazyMounts.unmounted += 1;
        };
      }, []);
      return (
        <div data-testid="lazy-route">{props.route.params.tokenAddress}</div>
      );
    },
}));

jest.mock('./utils/marketDetailPagePreload', () => ({
  getPreloadedMarketDetailV2Shell: () =>
    mockPreloadedComponent ? { default: mockPreloadedComponent } : undefined,
  loadMarketDetailV2Shell: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDesktop: true,
    isWeb: false,
  },
}));

const mockedPlatformEnv = platformEnv as typeof platformEnv & {
  isDesktop: boolean;
  isWeb: boolean;
};

function MockDirectRoute(props: {
  route: { params: { tokenAddress: string } };
}) {
  useEffect(() => {
    mockDirectMounts.mounted += 1;
    return () => {
      mockDirectMounts.unmounted += 1;
    };
  }, []);
  return (
    <div data-testid="direct-route">{props.route.params.tokenAddress}</div>
  );
}

function buildRouteProps(tokenAddress: string): IRouteProps {
  return {
    navigation: {} as IRouteProps['navigation'],
    route: {
      key: 'market-detail',
      name: ETabMarketRoutes.MarketDetailV2,
      params: { network: 'eth', tokenAddress },
    },
  };
}

describe('createMarketDetailV2Route', () => {
  beforeEach(() => {
    mockLazyMounts.mounted = 0;
    mockLazyMounts.unmounted = 0;
    mockDirectMounts.mounted = 0;
    mockDirectMounts.unmounted = 0;
    mockPreloadedComponent = undefined;
    mockedPlatformEnv.isDesktop = true;
    mockedPlatformEnv.isWeb = false;
  });

  it('keeps a cold-loaded route mounted after preload finishes', () => {
    const MarketDetailRoute = createMarketDetailV2Route();
    const view = render(<MarketDetailRoute {...buildRouteProps('first')} />);

    mockPreloadedComponent = MockDirectRoute;
    view.rerender(<MarketDetailRoute {...buildRouteProps('second')} />);

    expect(view.getByTestId('lazy-route').textContent).toBe('second');
    expect(view.queryByTestId('direct-route')).toBeNull();
    expect(mockLazyMounts).toEqual({ mounted: 1, unmounted: 0 });
    expect(mockDirectMounts).toEqual({ mounted: 0, unmounted: 0 });
  });

  it('uses the direct component when preload finished before first render', () => {
    mockPreloadedComponent = MockDirectRoute;
    const MarketDetailRoute = createMarketDetailV2Route();
    const view = render(<MarketDetailRoute {...buildRouteProps('ready')} />);

    expect(view.getByTestId('direct-route').textContent).toBe('ready');
    expect(view.queryByTestId('lazy-route')).toBeNull();
    expect(mockDirectMounts).toEqual({ mounted: 1, unmounted: 0 });
  });

  it('preserves the existing component selection behavior on native routes', () => {
    mockedPlatformEnv.isDesktop = false;
    const MarketDetailRoute = createMarketDetailV2Route();
    const view = render(<MarketDetailRoute {...buildRouteProps('first')} />);

    mockPreloadedComponent = MockDirectRoute;
    view.rerender(<MarketDetailRoute {...buildRouteProps('second')} />);

    expect(view.getByTestId('direct-route').textContent).toBe('second');
    expect(mockLazyMounts).toEqual({ mounted: 1, unmounted: 1 });
    expect(mockDirectMounts).toEqual({ mounted: 1, unmounted: 0 });
  });
});
