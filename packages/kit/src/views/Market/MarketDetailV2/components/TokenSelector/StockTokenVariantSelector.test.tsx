/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

import { StockTokenVariantSelector } from './StockTokenVariantSelector';

const setSelectedTokenIdMock = jest.fn();
const closePopoverMock = jest.fn();

const mockVariants: IMarketStockTokenVariant[] = [
  {
    tokenId: 'aapl-ethereum',
    // cspell:disable-next-line
    issuer: 'bstocks',
    issuerLogoUrl: 'https://example.com/bstocks.png',
    symbol: 'AAPLb',
    name: 'Apple Token',
    logoUrl: 'https://example.com/aapl.png',
    networkId: 'evm--1',
    networkName: 'Ethereum',
    networkLogoUrl: 'https://example.com/ethereum.png',
    contractAddress: '0x01',
    tradingHours: {
      days: '7 × 24',
    },
    price: '311.29',
    currency: 'USD',
    status: 'active',
    tradingEnabled: true,
  },
  {
    tokenId: 'aapl-bsc',
    issuer: 'ondo',
    issuerLogoUrl: 'https://example.com/ondo.png',
    symbol: 'AAPLon',
    name: 'Apple Token',
    logoUrl: 'https://example.com/aapl.png',
    networkId: 'evm--56',
    networkName: 'BNB Smart Chain',
    networkLogoUrl: 'https://example.com/bsc.png',
    contractAddress: '0x02',
    tradingHours: {
      days: '5 × 24',
    },
    price: '311.85',
    currency: 'USD',
    status: 'active',
    tradingEnabled: true,
  },
  {
    tokenId: 'aapl-paused',
    issuer: 'ondo',
    symbol: 'AAPLpaused',
    networkId: 'evm--137',
    contractAddress: '0x03',
    price: '312.42',
    currency: 'USD',
    status: 'paused',
    tradingEnabled: false,
  },
];

// One contract address deployed on two chains. EVM issuers reach the same
// address on several chains routinely, and this is the shape that makes an
// address-only portfolio lookup paint one chain's balance onto the other
// chain's row.
const sameAddressVariants: IMarketStockTokenVariant[] = [
  {
    tokenId: 'aapl-ethereum',
    issuer: 'ondo',
    issuerLogoUrl: 'https://example.com/ondo.png',
    symbol: 'AAPLon',
    name: 'Apple Token',
    logoUrl: 'https://example.com/aapl.png',
    networkId: 'evm--1',
    networkName: 'Ethereum',
    networkLogoUrl: 'https://example.com/ethereum.png',
    contractAddress: '0xSAME',
    price: '311.29',
    currency: 'USD',
    status: 'active',
    tradingEnabled: true,
  },
  {
    tokenId: 'aapl-base',
    issuer: 'ondo',
    issuerLogoUrl: 'https://example.com/ondo.png',
    symbol: 'AAPLon',
    name: 'Apple Token',
    logoUrl: 'https://example.com/aapl.png',
    networkId: 'evm--8453',
    networkName: 'Base',
    networkLogoUrl: 'https://example.com/base.png',
    // Same address, different casing, different chain.
    contractAddress: '0xsame',
    price: '311.85',
    currency: 'USD',
    status: 'active',
    tradingEnabled: true,
  },
];

const mockStockDetailState: {
  tokenVariants: IMarketStockTokenVariant[];
  selectedTokenId: string;
  portfolioNetworkId?: string;
} = {
  tokenVariants: mockVariants,
  selectedTokenId: mockVariants[0].tokenId,
  portfolioNetworkId: mockVariants[0].networkId,
};

// NetworkAvatarBase transitively pulls backgroundApiProxy, which cannot
// initialize inside jsdom — stub it like other suites do.
jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatarBase: () => null,
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => {
      const messages: Record<string, string> = {
        'dexmarket.token_name': 'Token',
        'global.balance': 'Balance',
        'trade_stocks.token_issuer': 'Issuer',
        'global.price': 'Quote price',
      };
      return messages[id] ?? id;
    },
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function StackComponent({
    children,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
  }) {
    return (
      <div data-testid={testID} onClick={onPress} role="presentation">
        {children}
      </div>
    );
  }

  return {
    Button: StackComponent,
    Icon: () => <span data-testid="icon" />,
    NumberSizeableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Popover: ({
      renderTrigger,
      renderContent,
    }: {
      renderTrigger: ReactNode;
      renderContent:
        | ReactNode
        | ((props: { closePopover: () => void }) => ReactNode);
    }) => (
      <>
        {renderTrigger}
        {typeof renderContent === 'function'
          ? renderContent({ closePopover: closePopoverMock })
          : renderContent}
      </>
    ),
    ScrollView: StackComponent,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Skeleton: () => <span data-testid="skeleton" />,
    Stack: StackComponent,
    XStack: StackComponent,
    YStack: StackComponent,
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => <span data-testid="token-logo" />,
}));

jest.mock('../../hooks/StockDetailContext', () => ({
  isStockTokenVariantTradable: (variant: IMarketStockTokenVariant) =>
    Boolean(variant.tradingEnabled && variant.status === 'active'),
  useStockDetail: () => ({
    tokenVariants: mockStockDetailState.tokenVariants,
    isTokenVariantsLoading: false,
    selectedTokenId: mockStockDetailState.selectedTokenId,
    selectedTokenVariant: mockStockDetailState.tokenVariants.find(
      (item) => item.tokenId === mockStockDetailState.selectedTokenId,
    ),
    setSelectedTokenId: setSelectedTokenIdMock,
    isTokenVariantsError: false,
    retryTokenVariants: jest.fn(),
    portfolioNetworkId: mockStockDetailState.portfolioNetworkId,
  }),
}));

describe('StockTokenVariantSelector', () => {
  beforeEach(() => {
    setSelectedTokenIdMock.mockReset();
    closePopoverMock.mockReset();
    mockStockDetailState.tokenVariants = mockVariants;
    mockStockDetailState.selectedTokenId = mockVariants[0].tokenId;
    mockStockDetailState.portfolioNetworkId = mockVariants[0].networkId;
  });

  it('renders backend variants and selects a token by tokenId', () => {
    render(
      <StockTokenVariantSelector
        portfolioData={[
          {
            accountAddress: '0xaccount',
            tokenAddress: '0x01',
            amount: '0.001',
            symbol: 'AAPLb',
            tokenPrice: '311.29',
            totalPrice: '0.31129',
          },
        ]}
      />,
    );

    expect(screen.getByText('Token/Balance')).toBeTruthy();
    expect(screen.getByText('Issuer')).toBeTruthy();
    expect(screen.getByText('Quote price')).toBeTruthy();
    expect(screen.getByText('24/7')).toBeTruthy();
    expect(screen.getByText('0.001')).toBeTruthy();
    expect(screen.getByText('bStocks')).toBeTruthy();
    expect(screen.getAllByText('Ondo')).toHaveLength(2);

    const secondRow = screen.getByTestId('stock-token-variant-row-1');
    expect(within(secondRow).getByText('AAPLon')).toBeTruthy();
    expect(within(secondRow).getByText('311.85')).toBeTruthy();

    fireEvent.click(secondRow);

    expect(setSelectedTokenIdMock).toHaveBeenCalledWith('aapl-bsc');
    expect(closePopoverMock).toHaveBeenCalledTimes(1);
  });

  it('does not select a disabled backend variant', () => {
    render(<StockTokenVariantSelector />);

    fireEvent.click(screen.getByTestId('stock-token-variant-row-2'));

    expect(setSelectedTokenIdMock).not.toHaveBeenCalled();
    expect(closePopoverMock).not.toHaveBeenCalled();
  });

  describe('balance attribution', () => {
    const position = (tokenAddress: string, amount: string) => [
      {
        accountAddress: '0xaccount',
        tokenAddress,
        amount,
        symbol: 'AAPLon',
        tokenPrice: '311.29',
        totalPrice: '3891.125',
      },
    ];

    it('never lends the fetched balance to a same-address variant on another chain', () => {
      mockStockDetailState.tokenVariants = sameAddressVariants;
      mockStockDetailState.selectedTokenId = 'aapl-ethereum';
      mockStockDetailState.portfolioNetworkId = 'evm--1';

      render(
        <StockTokenVariantSelector
          portfolioData={position('0xSAME', '12.5')}
        />,
      );

      // The row the portfolio was actually fetched for keeps its balance.
      const scopedRow = screen.getByTestId('stock-token-variant-row-0');
      expect(within(scopedRow).getByText('12.5')).toBeTruthy();

      // The Base row shares the contract address but not the chain, and the
      // payload carries no networkId to tell them apart — so it must fall back
      // to `--` rather than borrow the Ethereum balance.
      const otherChainRow = screen.getByTestId('stock-token-variant-row-1');
      expect(within(otherChainRow).queryByText('12.5')).toBeNull();
      expect(within(otherChainRow).getAllByText('--')).toHaveLength(1);
    });

    it('shows no balance at all when the selected variant left the portfolio network', () => {
      mockStockDetailState.tokenVariants = sameAddressVariants;
      mockStockDetailState.selectedTokenId = 'aapl-base';
      // Selecting a variant does not move the page's portfolio scope, which
      // stays on the stock route's network.
      mockStockDetailState.portfolioNetworkId = 'evm--1';

      render(
        <StockTokenVariantSelector
          portfolioData={position('0xSAME', '12.5')}
        />,
      );

      expect(screen.queryByText('12.5')).toBeNull();
      expect(screen.getAllByText('--')).toHaveLength(2);
    });

    it('ignores a portfolio payload that still describes the previous variant', () => {
      // The portfolio poll lags a variant switch, so the payload in hand can
      // still be the one fetched for the variant the user just left.
      mockStockDetailState.selectedTokenId = 'aapl-bsc';
      mockStockDetailState.portfolioNetworkId = 'evm--56';

      render(
        <StockTokenVariantSelector portfolioData={position('0x01', '0.001')} />,
      );

      expect(screen.queryByText('0.001')).toBeNull();
    });
  });
});
