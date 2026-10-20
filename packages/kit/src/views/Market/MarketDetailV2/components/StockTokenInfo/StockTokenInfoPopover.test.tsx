/** @jest-environment jsdom */

import type { ComponentType, ReactElement, ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

import { StockTokenInfoPopover } from './StockTokenInfoPopover';

const mockClosePopover = jest.fn();
const mockOpenUrlExternal = jest.fn();
const useStockDetailMock = jest.fn<
  { selectedTokenVariant: IMarketStockTokenVariant; stockId: string },
  []
>();

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
  }) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  return {
    Icon: Stack,
    IconButton: Stack,
    InteractiveIcon: Stack,
    SizableText: Stack,
    Stack,
    XStack: Stack,
    YStack: Stack,
    Popover: ({
      renderContent,
    }: {
      renderContent: ReactElement | ComponentType;
    }) => {
      if (typeof renderContent === 'function') {
        const Content = renderContent;
        return <Content />;
      }
      return renderContent;
    },
    usePopoverContext: () => ({ closePopover: mockClosePopover }),
    useClipboard: () => ({ copyText: jest.fn() }),
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { shortenAddress: ({ address }: { address: string }) => address },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: (...args: unknown[]) => {
    mockOpenUrlExternal(...args);
  },
}));
jest.mock('../../hooks/StockDetailContext', () => ({
  useStockDetail: () => useStockDetailMock(),
}));
jest.mock('../TokenSelector/StockTokenVariantSelector', () => ({
  getIssuerLabel: (issuer: string) => issuer,
}));
jest.mock('../../../components/MarketTooltipLabel', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react');
  return {
    MarketTooltipLabel: ({ children }: { children?: ReactNode }) => {
      const [open, setOpen] = useState(false);
      return (
        <span
          data-testid="shares-tooltip-trigger"
          onMouseEnter={() => setOpen(true)}
        >
          {children}
          {open ? <span role="tooltip">Shares explanation</span> : null}
        </span>
      );
    },
  };
});

const variant: IMarketStockTokenVariant = {
  tokenId: 'apple',
  issuer: 'ondo',
  symbol: 'AAPLon',
  networkId: 'evm--1',
  contractAddress: '0xstock',
  currency: 'USD',
  status: 'active',
  tradingEnabled: true,
};

beforeEach(() => {
  mockClosePopover.mockReset();
  mockOpenUrlExternal.mockReset();
});

describe('StockTokenInfoPopover shares', () => {
  it('preserves the hovered explanation across quote and variant refreshes', () => {
    useStockDetailMock.mockReturnValue({
      selectedTokenVariant: { ...variant, tokenToAssetRatio: '1' },
      stockId: 'AAPL',
    });
    const { rerender } = render(<StockTokenInfoPopover label="$319.97" />);
    fireEvent.mouseEnter(screen.getByTestId('shares-tooltip-trigger'));
    expect(screen.getByRole('tooltip')).toBeTruthy();

    useStockDetailMock.mockReturnValue({
      selectedTokenVariant: { ...variant, tokenToAssetRatio: '0.9985' },
      stockId: 'AAPL',
    });
    rerender(<StockTokenInfoPopover label="$320.01" />);

    expect(screen.getByRole('tooltip')).toBeTruthy();
    expect(screen.getByTestId('stock-token-info-shares').textContent).toContain(
      '0.9985 AAPL',
    );
  });

  it.each([undefined, '', '  ', '0', '-1', 'NaN', 'Infinity', 'invalid'])(
    'hides unavailable conversion ratio %p while retaining other token details',
    (ratio) => {
      useStockDetailMock.mockReturnValue({
        selectedTokenVariant: { ...variant, tokenToAssetRatio: ratio },
        stockId: 'AAPL',
      });
      render(<StockTokenInfoPopover label="$319.97" />);
      expect(screen.queryByTestId('stock-token-info-shares')).toBeNull();
      expect(
        screen.getByTestId('stock-token-info-underlying').textContent,
      ).toContain('AAPL');
      expect(
        screen.getByTestId('stock-token-info-contract').textContent,
      ).toContain('0xstock');
    },
  );

  it.each(['1', '0.9985', ' 0.12345678901234567890123456789 '])(
    'displays valid conversion ratio %p without losing precision',
    (ratio) => {
      useStockDetailMock.mockReturnValue({
        selectedTokenVariant: { ...variant, tokenToAssetRatio: ratio },
        stockId: 'AAPL',
      });
      render(<StockTokenInfoPopover label="$319.97" />);
      expect(
        screen.getByTestId('stock-token-info-shares').textContent,
      ).toContain(`${ratio.trim()} AAPL`);
    },
  );
});

describe('StockTokenInfoPopover issuer link', () => {
  it('closes the popover before opening the issuer website', async () => {
    const interactionOrder: string[] = [];
    mockClosePopover.mockImplementation(async () => {
      interactionOrder.push('close');
    });
    mockOpenUrlExternal.mockImplementation(() => {
      interactionOrder.push('open');
    });
    useStockDetailMock.mockReturnValue({
      selectedTokenVariant: {
        ...variant,
        website: 'https://ondo.finance',
      },
      stockId: 'AAPL',
    });

    render(<StockTokenInfoPopover label="$319.97" />);
    fireEvent.click(screen.getByTestId('stock-token-info-issuer-link'));

    await waitFor(() => {
      expect(mockOpenUrlExternal).toHaveBeenCalledWith('https://ondo.finance');
    });
    expect(interactionOrder).toEqual(['close', 'open']);
  });
});
