/** @jest-environment jsdom */

import { useEffect } from 'react';

import { render } from '@testing-library/react';

import { createMarketDetailV2Route } from './MarketDetailV2Route';

const mockLazyMounts = { mounted: 0, unmounted: 0 };
const mockDirectMounts = { mounted: 0, unmounted: 0 };
let mockPreloadedComponent:
  | ((props: { route: { params: { label: string } } }) => React.ReactNode)
  | undefined;

jest.mock('../../../components/LazyLoadPage', () => ({
  LazyLoadPage: () =>
    function MockLazyRoute(props: { route: { params: { label: string } } }) {
      useEffect(() => {
        mockLazyMounts.mounted += 1;
        return () => {
          mockLazyMounts.unmounted += 1;
        };
      }, []);
      return <div data-testid="lazy-route">{props.route.params.label}</div>;
    },
}));

jest.mock('./utils/marketDetailPagePreload', () => ({
  getPreloadedMarketDetailV2Shell: () =>
    mockPreloadedComponent ? { default: mockPreloadedComponent } : undefined,
  loadMarketDetailV2Shell: jest.fn(),
}));

function MockDirectRoute(props: { route: { params: { label: string } } }) {
  useEffect(() => {
    mockDirectMounts.mounted += 1;
    return () => {
      mockDirectMounts.unmounted += 1;
    };
  }, []);
  return <div data-testid="direct-route">{props.route.params.label}</div>;
}

function buildRouteProps(label: string) {
  return {
    navigation: {},
    route: { key: 'market-detail', name: 'MarketDetailV2', params: { label } },
  };
}

describe('createMarketDetailV2Route', () => {
  beforeEach(() => {
    mockLazyMounts.mounted = 0;
    mockLazyMounts.unmounted = 0;
    mockDirectMounts.mounted = 0;
    mockDirectMounts.unmounted = 0;
    mockPreloadedComponent = undefined;
  });

  it('keeps a cold-loaded route mounted after preload finishes', () => {
    const MarketDetailRoute = createMarketDetailV2Route();
    const view = render(
      <MarketDetailRoute {...(buildRouteProps('first') as any)} />,
    );

    mockPreloadedComponent = MockDirectRoute;
    view.rerender(
      <MarketDetailRoute {...(buildRouteProps('second') as any)} />,
    );

    expect(view.getByTestId('lazy-route').textContent).toBe('second');
    expect(view.queryByTestId('direct-route')).toBeNull();
    expect(mockLazyMounts).toEqual({ mounted: 1, unmounted: 0 });
    expect(mockDirectMounts).toEqual({ mounted: 0, unmounted: 0 });
  });

  it('uses the direct component when preload finished before first render', () => {
    mockPreloadedComponent = MockDirectRoute;
    const MarketDetailRoute = createMarketDetailV2Route();
    const view = render(
      <MarketDetailRoute {...(buildRouteProps('ready') as any)} />,
    );

    expect(view.getByTestId('direct-route').textContent).toBe('ready');
    expect(view.queryByTestId('lazy-route')).toBeNull();
    expect(mockDirectMounts).toEqual({ mounted: 1, unmounted: 0 });
  });
});
