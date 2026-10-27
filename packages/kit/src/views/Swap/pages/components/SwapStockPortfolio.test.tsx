/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { Portfolio } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/InformationTabs/components/Portfolio';
import type {
  IMarketAccountPortfolioDisplayItem,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { SwapStockMyPosition } from './SwapStockPortfolio';

let mockLargeLayout = true;
let mockSelectionPending = false;
let mockDisplayStockId = 'TSM';
let mockDisplayVariants: IMarketStockTokenVariant[] | undefined;
let mockItems: IMarketAccountPortfolioDisplayItem[] = [];
let mockTokens: ISwapToken[] = [];
let mockVariants: IMarketStockTokenVariant[] = [];
const mockSelectToken = jest.fn<Promise<boolean>, [ISwapToken]>();
const mockSelectVariant = jest.fn<
  Promise<boolean>,
  [IMarketStockTokenVariant]
>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
}));
jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    onPress,
  }: PropsWithChildren<{ onPress?: () => void }>) =>
    onPress ? (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ) : (
      <div>{children}</div>
    );
  return {
    DashText: Stack,
    Empty: () => null,
    NumberSizeableText: Stack,
    SizableText: Stack,
    Skeleton: Stack,
    Stack,
    Tabs: {
      FlatList: Stack,
      ScrollView: Stack,
    },
    XStack: Stack,
    YStack: Stack,
    useMedia: () => ({ gtLg: mockLargeLayout }),
  };
});
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: ({ children }: PropsWithChildren) => <span>{children}</span>,
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/InformationTabs/components/Portfolio/components/PnlCell',
  () => ({ PnlCell: () => null }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext',
  () => ({
    useStockDetail: () => ({ stockId: 'TSM', tokenVariants: mockVariants }),
  }),
);
jest.mock('./SwapStockPositions', () => ({
  useSwapStockPositions: () => ({
    positionTokenList: mockTokens,
    portfolio: {
      positionListData: mockItems,
      hasAccount: true,
      isRefreshing: false,
    },
    displayPortfolio: {
      positionListData: mockItems,
      hasAccount: true,
      isRefreshing: false,
    },
  }),
}));
jest.mock('./SwapStockMarketProvider', () => ({
  useSwapStockSelection: () => ({
    selectToken: mockSelectToken,
    selectVariant: mockSelectVariant,
    stockSelectionPending: mockSelectionPending,
    displayStockId: mockDisplayStockId,
    displayTokenVariants: mockDisplayVariants ?? mockVariants,
  }),
}));
jest.mock('./SwapSmoothReveal', () => ({
  SwapSmoothReveal: ({
    children,
    visible,
  }: PropsWithChildren<{ visible: boolean }>) => (visible ? children : null),
}));

const variant: IMarketStockTokenVariant = {
  tokenId: 'tsm-56',
  issuer: 'Ondo',
  networkId: 'evm--56',
  contractAddress: '0xABCD',
  symbol: 'TSMon',
  currency: 'USD',
  status: 'active',
  tradingEnabled: true,
};
const token: ISwapToken = {
  networkId: variant.networkId,
  contractAddress: variant.contractAddress,
  symbol: 'TSMon',
  decimals: 18,
  stock: { subtitle: 'TSM', sourceLogoUri: '' },
};
const item: IMarketAccountPortfolioDisplayItem = {
  networkId: variant.networkId,
  tokenAddress: '0xabcd',
  accountAddress: '0xaccount',
  symbol: 'TSMon',
  amount: '2',
  tokenPrice: '400',
  totalPrice: '800',
};

function renderPosition() {
  return render(<SwapStockMyPosition />);
}

describe('SwapStockMyPosition selection', () => {
  beforeEach(() => {
    mockLargeLayout = true;
    mockSelectionPending = false;
    mockDisplayStockId = 'TSM';
    mockDisplayVariants = undefined;
    mockItems = [item, { ...item, networkId: 'evm--1', amount: '3' }];
    mockTokens = [{ ...token, networkId: 'evm--1' }, token];
    mockVariants = [variant, { ...variant, networkId: 'evm--1' }];
    mockSelectToken.mockReset().mockResolvedValue(true);
    mockSelectVariant.mockReset().mockResolvedValue(true);
  });

  it('keeps the display-scoped holdings visible while the trade token is pending', () => {
    mockSelectionPending = true;
    const screen = renderPosition();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('collapses a genuinely empty display portfolio while selection is pending', () => {
    mockSelectionPending = true;
    mockItems = [];
    const screen = renderPosition();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('dexmarket_details_myposition')).toBeNull();
  });

  it('never backfills the old company identity into a preview holding', () => {
    mockSelectionPending = true;
    mockDisplayStockId = 'GOOGL';
    const google = { ...token, symbol: 'GOOGLB', contractAddress: '0xGOOGLE' };
    mockTokens = [google];
    mockItems = [
      { ...item, symbol: google.symbol, tokenAddress: google.contractAddress },
    ];
    mockDisplayVariants = [
      { ...variant, contractAddress: google.contractAddress },
    ];
    const screen = renderPosition();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(mockSelectToken).toHaveBeenCalledWith({
      ...google,
      stock: { ...google.stock, stockId: 'GOOGL' },
    });
    expect(mockSelectVariant).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'selects the exact holding by network and contract (large=%s)',
    (large) => {
      mockLargeLayout = large;
      const screen = renderPosition();

      fireEvent.click(screen.getAllByRole('button')[0]);

      expect(mockSelectToken).toHaveBeenCalledWith({
        ...token,
        stock: { ...token.stock, stockId: 'TSM' },
      });
      expect(mockSelectVariant).not.toHaveBeenCalled();
    },
  );

  it('uses the current variant while the all-positions list is unavailable', () => {
    mockTokens = [];
    const screen = renderPosition();

    fireEvent.click(screen.getAllByRole('button')[1]);

    expect(mockSelectVariant).toHaveBeenCalledWith(mockVariants[1]);
    expect(mockSelectToken).not.toHaveBeenCalled();
  });

  it('retains held-token selection for a paused variant', () => {
    mockVariants = [{ ...variant, status: 'inactive', tradingEnabled: false }];
    mockTokens = [{ ...token, stock: { ...token.stock!, isPaused: true } }];
    const screen = renderPosition();

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(mockSelectToken).toHaveBeenCalledWith({
      ...mockTokens[0],
      stock: { ...mockTokens[0].stock, stockId: 'TSM' },
    });
    expect(mockSelectVariant).not.toHaveBeenCalled();
  });

  it('preserves an existing stock identity', () => {
    mockTokens = [{ ...token, stock: { ...token.stock!, stockId: 'tsm' } }];
    const screen = renderPosition();

    fireEvent.click(screen.getAllByRole('button')[0]);

    expect(mockSelectToken).toHaveBeenCalledWith(mockTokens[0]);
  });

  it('keeps Solana contract matching case-sensitive', () => {
    mockItems = [{ ...item, networkId: 'sol--101', tokenAddress: 'AbC' }];
    mockTokens = [
      { ...token, networkId: 'sol--101', contractAddress: 'abc' },
      { ...token, networkId: 'sol--101', contractAddress: 'AbC' },
    ];
    mockVariants = [];
    const screen = renderPosition();

    fireEvent.click(screen.getByRole('button'));

    expect(mockSelectToken).toHaveBeenCalledWith(mockTokens[1]);
  });

  it('does not guess an unknown contract from the displayed symbol', () => {
    mockItems = [{ ...item, tokenAddress: '0xother' }];
    const screen = renderPosition();

    fireEvent.click(screen.getByRole('button'));

    expect(mockSelectToken).not.toHaveBeenCalled();
    expect(mockSelectVariant).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'keeps Portfolio read-only without a callback (large=%s)',
    (large) => {
      mockLargeLayout = large;
      const screen = render(
        <Portfolio standalone hasAccount portfolioData={[item]} />,
      );

      expect(screen.queryByRole('button')).toBeNull();
      fireEvent.click(screen.getByText(item.amount));
      expect(mockSelectToken).not.toHaveBeenCalled();
      expect(mockSelectVariant).not.toHaveBeenCalled();
    },
  );
});
