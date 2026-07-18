/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockChannelStage,
  ESwapStockTradeSide,
} from '../../hooks/swapStockChannelUtils';

import { StockEstimatedReceive } from './SwapStockDesktopContainer';

import type { IUseSwapStockChannelReturn } from '../../hooks/useSwapStockChannel';

const mockSetToTokenAmount = jest.fn();

type IPrimitiveProps = {
  children?: ReactNode | ((state: { open: boolean }) => ReactNode);
  testID?: string;
};

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Primitive = ({ children, testID }: IPrimitiveProps) =>
    React.createElement(
      'div',
      { 'data-testid': testID },
      typeof children === 'function' ? children({ open: false }) : children,
    );
  return {
    __esModule: true,
    HeaderButtonGroup: Primitive,
    HeaderIconButton: Primitive,
    Icon: Primitive,
    NumberSizeableText: Primitive,
    Popover: Primitive,
    SizableText: Primitive,
    Skeleton: () =>
      React.createElement('div', {
        'data-testid': 'stock-estimated-receive-skeleton',
      }),
    XStack: Primitive,
    YStack: Primitive,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: IPrimitiveProps) => children,
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: ({ logoUri }: { logoUri?: string }) => logoUri,
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapFromTokenAmountAtom: () => [{ value: '1000', isInput: true }],
  useSwapQuoteEventErrorAtom: () => [undefined],
  useSwapToTokenAmountAtom: () => [
    { value: 'stale-atom-amount', isInput: false },
    mockSetToTokenAmount,
  ],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [
    {
      currencyMap: {
        usd: { unit: '$' },
      },
    },
  ],
  useSettingsPersistAtom: () => [
    {
      currencyInfo: {
        id: 'usd',
        symbol: '$',
      },
    },
  ],
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenList',
  () => ({ TokenList: () => null }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TradeTypeSelector',
  () => ({ TradeTypeSelector: () => null }),
);

jest.mock('react-intl', () => {
  const intl = {
    formatMessage: ({ id }: { id: string }) => id,
  };
  return { useIntl: () => intl };
});

jest.mock('../../components/SwapRateDifferenceText', () => ({
  SwapRateDifferenceText: () => null,
}));

jest.mock('../../hooks/useSwapAccount', () => ({
  useSwapAddressInfo: () => ({ accountInfo: undefined }),
}));

jest.mock('../../hooks/useSwapPro', () => ({
  useSwapProSupportNetworksTokenList: jest.fn(),
}));

jest.mock('../../hooks/useSwapStockChannel', () =>
  jest.requireActual<typeof import('../../hooks/swapStockChannelUtils')>(
    '../../hooks/swapStockChannelUtils',
  ),
);

jest.mock('../../utils/swapStockTradeControl', () => {
  const actual = jest.requireActual<
    typeof import('../../utils/swapStockTradeControl')
  >('../../utils/swapStockTradeControl');
  return {
    ...actual,
    getStockQuoteTradeControl: () => undefined,
  };
});

jest.mock('./SwapStockTradeAlertUtils', () => ({
  isCurrentStockQuoteEventError: () => false,
}));

jest.mock('./SwapActionsState', () => () => null);
jest.mock('./SwapHeaderRightActionContainer', () => ({
  SwapSettingsHeaderButton: () => null,
}));
jest.mock('./SwapInputContainer', () => ({
  PercentageStageOnKeyboard: () => null,
}));
jest.mock('./SwapMarketHistoryList', () => () => null);
jest.mock('./SwapPendingHistoryList', () => () => null);
jest.mock('./SwapQuoteResult', () => () => null);

const stockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
  isStock: true,
};

const payToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};

const quoteResult = {
  fromAmount: '1000',
  fromTokenInfo: payToken,
  info: { provider: 'stock' },
  toAmount: '10',
  toTokenInfo: stockToken,
} as IFetchQuoteResult;

function buildStockChannel(
  channelStage: ESwapStockChannelStage,
): IUseSwapStockChannelReturn {
  return {
    channelStage,
    currentStockToken: stockToken,
    fromToken: payToken,
    payToken,
    payTokens: [payToken],
    selectablePayTokens: [payToken],
    selectPayToken: jest.fn(),
    toToken: stockToken,
    tradeSide: ESwapStockTradeSide.Buy,
  } as unknown as IUseSwapStockChannelReturn;
}

describe('StockEstimatedReceive', () => {
  beforeEach(() => {
    mockSetToTokenAmount.mockClear();
  });

  it('settles a retained quote without a skeleton on a ready-to-closed transition', () => {
    const view = render(
      <StockEstimatedReceive
        displayQuoteResult={quoteResult}
        quoteEventFetching={false}
        quoteLoading={false}
        quoteResult={quoteResult}
        stockChannel={buildStockChannel(ESwapStockChannelStage.Ready)}
      />,
    );

    expect(
      screen.queryAllByTestId('stock-estimated-receive-skeleton'),
    ).toHaveLength(0);
    expect(screen.getByText('10')).toBeTruthy();

    view.rerender(
      <StockEstimatedReceive
        displayQuoteResult={quoteResult}
        quoteEventFetching={false}
        quoteLoading
        quoteResult={quoteResult}
        stockChannel={buildStockChannel(ESwapStockChannelStage.MarketClosed)}
      />,
    );

    expect(
      screen.queryAllByTestId('stock-estimated-receive-skeleton'),
    ).toHaveLength(0);
    expect(screen.queryByText('10')).toBeNull();
    expect(screen.getByText('--')).toBeTruthy();
  });

  it.each([
    ESwapStockChannelStage.Ready,
    ESwapStockChannelStage.MarketUnavailable,
  ])('renders upstream quote loading for %s', (channelStage) => {
    render(
      <StockEstimatedReceive
        quoteEventFetching={false}
        quoteLoading
        stockChannel={buildStockChannel(channelStage)}
      />,
    );

    expect(
      screen.queryAllByTestId('stock-estimated-receive-skeleton'),
    ).toHaveLength(2);
  });
});
