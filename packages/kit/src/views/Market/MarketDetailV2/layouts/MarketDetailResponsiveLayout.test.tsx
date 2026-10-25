/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { MarketDetailResponsiveLayout } from './MarketDetailResponsiveLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

const mockLayoutMount = jest.fn();
const mockLayoutUnmount = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Spinner: () => null,
    Stack: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => React.createElement('div', { 'data-testid': testID }, children),
  };
});

jest.mock('./DesktopLayout', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    DesktopLayout: ({
      marketTokenCategory,
    }: {
      marketTokenCategory?: string;
    }) => {
      React.useEffect(() => {
        mockLayoutMount(marketTokenCategory);
        return mockLayoutUnmount;
      }, [marketTokenCategory]);
      return React.createElement('div', { 'data-testid': 'desktop-layout' });
    },
  };
});

jest.mock('./MobileLayout', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    MobileLayout: () =>
      React.createElement('div', { 'data-testid': 'mobile-layout' }),
  };
});

const props: IMarketDetailResponsiveLayoutProps = {
  isDesktopLayout: true,
  isChartFullscreen: false,
  isTradingViewNative: true,
  onChartSwitch: jest.fn(),
  onChartFullscreenChange: jest.fn(),
  networkId: 'evm--1',
  tokenAddress: '0xtoken',
  isNative: false,
};

describe('Market detail layout resolution', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(['top_coins', undefined])(
    'mounts the desktop content only after resolving category %s',
    (marketTokenCategory) => {
      const { rerender } = render(
        <MarketDetailResponsiveLayout {...props} isLayoutPending />,
      );
      expect(screen.getByTestId('market-detail-layout-loading')).toBeTruthy();
      expect(mockLayoutMount).not.toHaveBeenCalled();

      rerender(
        <MarketDetailResponsiveLayout
          {...props}
          isLayoutPending={false}
          marketTokenCategory={marketTokenCategory}
        />,
      );
      expect(screen.queryByTestId('market-detail-layout-loading')).toBeNull();
      expect(mockLayoutMount).toHaveBeenCalledTimes(1);
      expect(mockLayoutMount).toHaveBeenCalledWith(marketTokenCategory);

      rerender(
        <MarketDetailResponsiveLayout
          {...props}
          marketTokenCategory={marketTokenCategory}
          isMarketAssetDetailLoading
        />,
      );
      expect(mockLayoutMount).toHaveBeenCalledTimes(1);
      expect(mockLayoutUnmount).not.toHaveBeenCalled();
    },
  );

  it('does not delay entries whose category is already known', () => {
    render(
      <MarketDetailResponsiveLayout
        {...props}
        marketTokenCategory="top_coins"
      />,
    );
    expect(screen.getByTestId('desktop-layout')).toBeTruthy();
    expect(mockLayoutMount).toHaveBeenCalledTimes(1);
  });

  it('keeps a narrow known-network entry on the mobile layout while pending', () => {
    render(
      <MarketDetailResponsiveLayout
        {...props}
        isDesktopLayout={false}
        isLayoutPending
      />,
    );

    expect(screen.queryByTestId('market-detail-layout-loading')).toBeNull();
    expect(screen.getByTestId('mobile-layout')).toBeTruthy();
  });

  it('waits for an Asset-only identity before mounting the narrow layout', () => {
    const { rerender } = render(
      <MarketDetailResponsiveLayout
        {...props}
        isDesktopLayout={false}
        networkId=""
        tokenAddress=""
        isLayoutPending
      />,
    );
    expect(screen.getByTestId('market-detail-layout-loading')).toBeTruthy();
    expect(screen.queryByTestId('mobile-layout')).toBeNull();

    rerender(
      <MarketDetailResponsiveLayout
        {...props}
        isDesktopLayout={false}
        isLayoutPending={false}
      />,
    );
    expect(screen.queryByTestId('market-detail-layout-loading')).toBeNull();
    expect(screen.getByTestId('mobile-layout')).toBeTruthy();
  });
});
