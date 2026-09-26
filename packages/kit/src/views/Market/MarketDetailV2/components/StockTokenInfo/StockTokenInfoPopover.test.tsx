/** @jest-environment jsdom */

import type { ReactNode } from 'react';

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
      renderContent: (props: unknown) => ReactNode;
    }) => renderContent({ closePopover: mockClosePopover }),
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
// The dashed label pulls in Tooltip and DashText, neither of which this
// file's component mock provides. The row only has to render its label here.
jest.mock('../../../components/MarketTooltipLabel', () => ({
  MarketTooltipLabel: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

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
