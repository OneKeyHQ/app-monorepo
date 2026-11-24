/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { MobileLayout } from './StockAwareMobileLayout';

let mockIsStockRoute = true;

jest.mock('../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({ isStockRoute: mockIsStockRoute }),
}));
jest.mock('./MobileAssetLayout', () => ({
  MobileLayout: ({ disableTrade }: { disableTrade?: boolean }) => (
    <div data-testid="stock-detail" data-readonly={disableTrade} />
  ),
}));
jest.mock('./legacyMobileLayout', () => ({
  MobileLayout: () => <div data-testid="token-detail" />,
}));

it('uses stock detail for a routed stock and restores token detail on navigation', () => {
  const props = {
    disableTrade: true,
    isChartFullscreen: false,
    isTradingViewNative: false,
    onChartFullscreenChange: jest.fn(),
    onChartSwitch: jest.fn(),
  };
  const { rerender } = render(<MobileLayout {...props} />);
  expect(screen.getByTestId('stock-detail').getAttribute('data-readonly')).toBe(
    'true',
  );
  expect(screen.queryByTestId('token-detail')).toBeNull();

  mockIsStockRoute = false;
  rerender(<MobileLayout {...props} />);
  expect(screen.getByTestId('token-detail')).toBeTruthy();
  expect(screen.queryByTestId('stock-detail')).toBeNull();
});
