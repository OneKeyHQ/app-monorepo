/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import { ESwapProTimeRange } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import SwapProBuySellGroup from './SwapProBuySellGroup';

let mockDetail: IMarketTokenDetail | undefined;
let mockTimeRange: { label: string; value: ESwapProTimeRange };
let mockIsHyperliquidBtc: boolean;

jest.mock('@onekeyhq/components', () => ({
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapProSelectTokenAtom: () => [{ symbol: 'ETH' }],
  useSwapProTokenMarketDetailInfoAtom: () => [mockDetail],
  useSwapProTimeRangeAtom: () => [
    mockTimeRange,
    (next: { label: string; value: ESwapProTimeRange }) => {
      mockTimeRange = next;
    },
  ],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    swap: { swapPro: { swapProTimeRangeChange: jest.fn() } },
  },
}));

jest.mock('../../utils/swapProTransactionSource', () => ({
  isSwapProHyperliquidBtcToken: () => mockIsHyperliquidBtc,
}));

jest.mock('../../components/SwapProBuySellInfo', () => ({
  __esModule: true,
  default: () => <div data-testid="buy-sell-info" />,
}));

jest.mock('../../components/SwapProTimeRangeSelector', () => ({
  __esModule: true,
  default: ({
    onChange,
    selectedValue,
  }: {
    onChange: (value: ESwapProTimeRange) => void;
    selectedValue: { value: ESwapProTimeRange };
  }) => (
    <button
      type="button"
      data-testid="time-range-selector"
      onClick={() => onChange(ESwapProTimeRange.FOUR_HOURS)}
    >
      {selectedValue.value}
    </button>
  ),
}));

function detail(overrides: Partial<IMarketTokenDetail>): IMarketTokenDetail {
  return {
    address: '',
    decimals: 18,
    logoUrl: '',
    name: 'Ether',
    symbol: 'ETH',
    ...overrides,
  };
}

describe('SwapProBuySellGroup', () => {
  beforeEach(() => {
    mockDetail = undefined;
    mockTimeRange = { label: '1H', value: ESwapProTimeRange.ONE_HOUR };
    mockIsHyperliquidBtc = false;
  });

  it('hides statistics while switching to a token without buy and sell data', () => {
    mockDetail = detail({ vBuy1h: '12', vSell1h: '3' });
    const { rerender } = render(<SwapProBuySellGroup supportSpeedSwap />);

    expect(screen.getByTestId('buy-sell-info')).toBeTruthy();

    mockDetail = undefined;
    rerender(<SwapProBuySellGroup supportSpeedSwap />);
    expect(screen.queryByTestId('buy-sell-info')).toBeNull();
    expect(screen.getByTestId('time-range-selector')).toBeTruthy();

    mockDetail = detail({});
    rerender(<SwapProBuySellGroup supportSpeedSwap />);
    expect(screen.queryByTestId('buy-sell-info')).toBeNull();
    expect(screen.getByTestId('time-range-selector')).toBeTruthy();

    mockDetail = undefined;
    rerender(<SwapProBuySellGroup supportSpeedSwap />);
    expect(screen.queryByTestId('buy-sell-info')).toBeNull();

    mockDetail = detail({ vBuy1h: '0', vSell1h: '0' });
    rerender(<SwapProBuySellGroup supportSpeedSwap />);
    expect(screen.getByTestId('buy-sell-info')).toBeTruthy();
    expect(screen.getByTestId('time-range-selector')).toBeTruthy();
  });

  it.each([
    ['missing fields', {}],
    ['unavailable fields', { vBuy1h: '-', vSell1h: '-' }],
    ['one missing field', { vBuy1h: '12' }],
  ])(
    'hides unavailable statistics for %s but keeps the selector',
    (_, fields) => {
      mockDetail = detail(fields);
      render(<SwapProBuySellGroup supportSpeedSwap />);

      expect(screen.queryByTestId('buy-sell-info')).toBeNull();
      expect(screen.getByTestId('time-range-selector')).toBeTruthy();
    },
  );

  it.each([
    ['zero', { vBuy1h: '0', vSell1h: '0' }],
    ['positive values', { vBuy1h: '12.5', vSell1h: '3' }],
  ])('shows statistics for %s', (_, fields) => {
    mockDetail = detail(fields);
    render(<SwapProBuySellGroup supportSpeedSwap />);

    expect(screen.getByTestId('buy-sell-info')).toBeTruthy();
    expect(screen.getByTestId('time-range-selector')).toBeTruthy();
  });

  it('rechecks availability when the time range changes', () => {
    mockDetail = detail({ vBuy4h: '1', vSell4h: '2' });
    const { rerender } = render(<SwapProBuySellGroup supportSpeedSwap />);

    expect(screen.queryByTestId('buy-sell-info')).toBeNull();
    fireEvent.click(screen.getByTestId('time-range-selector'));
    rerender(<SwapProBuySellGroup supportSpeedSwap />);

    expect(screen.getByTestId('buy-sell-info')).toBeTruthy();
    expect(screen.getByTestId('time-range-selector').textContent).toBe('4h');
  });

  it('continues hiding statistics for the Hyperliquid BTC source', () => {
    mockIsHyperliquidBtc = true;
    mockDetail = detail({ vBuy1h: '1', vSell1h: '2' });
    render(<SwapProBuySellGroup supportSpeedSwap />);

    expect(screen.queryByTestId('buy-sell-info')).toBeNull();
    expect(screen.getByTestId('time-range-selector')).toBeTruthy();
  });
});
