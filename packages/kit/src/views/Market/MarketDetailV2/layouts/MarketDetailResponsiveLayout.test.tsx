/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { MarketDetailResponsiveLayout } from './MarketDetailResponsiveLayout';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

const mockLayoutMount = jest.fn();
const mockLayoutUnmount = jest.fn();
const mockMobileLayout = jest.fn((_props: Record<string, unknown>) => null);

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

jest.mock('./MobileLayout', () => ({
  MobileLayout: (layoutProps: Record<string, unknown>) =>
    mockMobileLayout(layoutProps),
}));

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

  it.each([true, false])(
    'passes route ownership to narrow layouts: %s',
    (active) => {
      render(
        <MarketDetailResponsiveLayout
          {...props}
          isDesktopLayout={false}
          active={active}
        />,
      );
      expect(mockMobileLayout).toHaveBeenCalledWith(
        expect.objectContaining({ active }),
      );
    },
  );

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
});
