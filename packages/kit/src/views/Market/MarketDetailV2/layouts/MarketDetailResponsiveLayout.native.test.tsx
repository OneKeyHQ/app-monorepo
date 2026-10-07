/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { MarketDetailResponsiveLayout } from './MarketDetailResponsiveLayout.native';

import type { IMarketDetailResponsiveLayoutProps } from './MarketDetailResponsiveLayout.types';

const mockMobileLayout = jest.fn((_props: Record<string, unknown>) => null);

jest.mock('./MobileLayout', () => ({
  MobileLayout: (props: Record<string, unknown>) => {
    mockMobileLayout(props);
    return null;
  },
}));

const props: IMarketDetailResponsiveLayoutProps = {
  isDesktopLayout: false,
  isChartFullscreen: false,
  isTradingViewNative: true,
  onChartSwitch: jest.fn(),
  onChartFullscreenChange: jest.fn(),
  isNative: true,
  networkId: 'evm--1',
  tokenAddress: '0xtoken',
};

describe('native market detail layout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes layout readiness to the single mobile loading owner', () => {
    render(
      <MarketDetailResponsiveLayout
        {...props}
        isLayoutPending
        isInitialContentPending
      />,
    );

    expect(mockMobileLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        isLayoutPending: true,
        isInitialContentPending: true,
      }),
    );
  });
});
