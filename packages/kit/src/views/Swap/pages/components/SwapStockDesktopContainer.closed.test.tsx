/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen, within } from '@testing-library/react';

import {
  ESwapStockChannelAsyncStatus,
  ESwapStockChannelStage,
  ESwapStockTradeSide,
} from '../../hooks/swapStockChannelUtils';

import { SwapStockMobileContainer } from './SwapStockDesktopContainer';

import type { ISwapStockDesktopContainerProps } from './SwapStockDesktopContainer';
import type { IUseSwapStockChannelReturn } from '../../hooks/useSwapStockChannel';

type IAmountInputProps = {
  inputProps?: {
    readonly?: boolean;
    testID?: string;
  };
};

type IPrimitiveProps = {
  children?: ReactNode | ((state: { open: boolean }) => ReactNode);
  testID?: string;
};

const mockAmountInput = jest.fn();
const mockSetInAppNotification = jest.fn();
const mockSetToTokenAmount = jest.fn();
const mockUseSwapStockAmountInputState = jest.fn<unknown, [unknown]>();

const mockStockToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPLon',
  decimals: 18,
  isStock: true,
};
const mockPayToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};
const mockQuoteResult = {
  fromAmount: '1',
  fromTokenInfo: mockPayToken,
  info: { provider: 'stock', providerName: 'Stock' },
  toAmount: '0.01',
  toTokenInfo: mockStockToken,
};
const mockClosedStockChannel = {
  activeStockTokenDetail: undefined,
  channelStage: ESwapStockChannelStage.MarketClosed,
  currentStockToken: mockStockToken,
  fromToken: mockPayToken,
  marketStatusStatus: ESwapStockChannelAsyncStatus.Ready,
  payToken: mockPayToken,
  payTokenStatus: ESwapStockChannelAsyncStatus.Ready,
  payTokens: [mockPayToken],
  readyForQuote: false,
  selectRecentTokenPair: jest.fn(),
  selectablePayTokens: [mockPayToken],
  stockDisplay: {
    displayTokenDetail: undefined,
    selection: {
      snapshot: {
        identity: { accountKey: 'account-1' },
        payToken: mockPayToken,
        stockToken: mockStockToken,
        tradeSide: ESwapStockTradeSide.Buy,
        updatedAt: 1,
      },
    },
  },
  stockNetworkId: mockStockToken.networkId,
  stockTokenStatus: ESwapStockChannelAsyncStatus.Ready,
  switchTradeSide: jest.fn(),
  toToken: mockStockToken,
  tradeSide: ESwapStockTradeSide.Buy,
} as unknown as IUseSwapStockChannelReturn;

jest.mock('@tamagui/core', () => ({
  useTheme: () => ({}),
}));

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
    Button: Primitive,
    Divider: Primitive,
    HeaderButtonGroup: Primitive,
    HeaderIconButton: Primitive,
    Icon: Primitive,
    KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET: 0,
    Keyboard: { AwareScrollView: Primitive },
    NumberSizeableText: Primitive,
    Page: { Footer: Primitive },
    Popover: Primitive,
    ScrollView: Primitive,
    SegmentControl: Primitive,
    SizableText: Primitive,
    Skeleton: () =>
      React.createElement('div', { 'data-testid': 'stock-ui-skeleton' }),
    Stack: Primitive,
    XStack: Primitive,
    YStack: Primitive,
    resetToRoute: jest.fn(),
    useIsOverlayPage: () => true,
    useMedia: () => ({ md: false }),
    usePopoverContext: () => ({ closePopover: jest.fn() }),
    useScrollContentTabBarOffset: () => 0,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: IPrimitiveProps) => children,
}));

jest.mock('@onekeyhq/kit/src/components/AmountInput', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    AmountInput: (props: IAmountInputProps) => {
      mockAmountInput(props);
      return React.createElement('input', {
        'data-testid': 'wired-stock-amount-input',
        readOnly: props.inputProps?.readonly,
      });
    },
  };
});

jest.mock('@onekeyhq/kit/src/components/LightweightChart', () => ({
  LightweightChart: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}));

jest.mock('@onekeyhq/kit/src/hooks/useIdentityScopedSilentRefresh', () => ({
  useIdentityScopedSilentRefresh: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: ({ logoUri }: { logoUri?: string }) => logoUri,
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _callback: unknown,
    _dependencies: unknown,
    options?: { initResult?: unknown },
  ) => ({ isLoading: false, result: options?.initResult }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({ current: { swapTypeSwitchAction: jest.fn() } }),
  useSwapFromTokenAmountAtom: () => [{ isInput: true, value: '1' }, jest.fn()],
  useSwapProEnableCurrentSymbolAtom: () => [false],
  useSwapQuoteEventErrorAtom: () => [undefined],
  useSwapSelectFromTokenAtom: () => [mockPayToken],
  useSwapSelectToTokenAtom: () => [mockStockToken],
  useSwapToTokenAmountAtom: () => [
    { isInput: false, value: 'stale-receive' },
    mockSetToTokenAmount,
  ],
}));

jest.mock('@onekeyhq/kit/src/views/Market/components/MarketTokenPrice', () => ({
  BaseMarketTokenPrice: () => null,
}));

jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  StockIsOpenBadge: () => null,
  StockSourceLogo: () => null,
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage',
  () => ({ PriceChangePercentage: () => null }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenList',
  () => ({ TokenList: () => null }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TradeTypeSelector',
  () => ({ TradeTypeSelector: () => null }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: { usd: { unit: '$' } } }],
  useInAppNotificationAtom: () => [{}, mockSetInAppNotification],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd', symbol: '$' } }],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isJest: true,
    isNative: false,
    isNativeIOS: false,
    isWebDappMode: false,
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('../../components/SwapFAQ', () => () => null);
jest.mock('../../components/SwapRateDifferenceText', () => ({
  SwapRateDifferenceText: () => null,
}));
jest.mock('../../components/SwapRecentTokenPairsGroup', () => () => null);

jest.mock('../../hooks/useSwapAccount', () => ({
  useSwapAddressInfo: () => ({ accountInfo: undefined }),
}));

jest.mock('../../hooks/useSwapLocalDataVisibility', () => ({
  useSwapLimitOrdersLocalDataVisibility: () => ({
    shouldShowSwapLimitOrders: false,
    shouldShowSwapLocalData: false,
  }),
}));

jest.mock('../../hooks/useSwapMarketHistoryList', () => ({
  useSwapMarketHistoryList: () => ({ swapTxHistoryList: [] }),
}));

jest.mock('../../hooks/useSwapPro', () => ({
  useSwapProSupportNetworksTokenList: jest.fn(),
}));

jest.mock('../../hooks/swapStockDisplaySnapshotStorage', () => ({
  swapStockDisplaySnapshotStorage: {
    get: () => undefined,
  },
}));

jest.mock('../../hooks/useSwapStockChannel', () =>
  jest.requireActual<typeof import('../../hooks/swapStockChannelUtils')>(
    '../../hooks/swapStockChannelUtils',
  ),
);

jest.mock('../../hooks/useSwapStockTradeInputs', () => {
  const actual = jest.requireActual<
    typeof import('../../hooks/useSwapStockTradeInputs')
  >('../../hooks/useSwapStockTradeInputs');
  return {
    ...actual,
    useSwapStockAmountInputState: (params: unknown) =>
      mockUseSwapStockAmountInputState(params),
  };
});

jest.mock('../../utils/swapStockTradeControl', () => {
  const actual = jest.requireActual<
    typeof import('../../utils/swapStockTradeControl')
  >('../../utils/swapStockTradeControl');
  return {
    ...actual,
    getStockQuoteTradeControl: () => undefined,
  };
});

jest.mock('./SwapActionsState', () => () => null);
jest.mock('./SwapHeaderRightActionContainer', () => ({
  SwapSettingsHeaderButton: () => null,
}));
jest.mock('./SwapHistoryClearButton', () => () => null);
jest.mock('./SwapInputActions', () => () => null);
jest.mock('./SwapInputContainer', () => ({
  PercentageStageOnKeyboard: () => null,
}));
jest.mock('./SwapMarketHistoryList', () => () => null);
jest.mock('./SwapPendingHistoryList', () => () => null);
jest.mock('./SwapProCurrentSymbolEnable', () => () => null);
jest.mock('./SwapProPositionsList', () => () => null);
jest.mock('./SwapQuoteResult', () => () => null);
jest.mock('./SwapStockTradeAlert', () => ({ SwapStockTradeAlert: () => null }));
jest.mock('./SwapStockTradeAlertUtils', () => ({
  isCurrentStockQuoteEventError: () => false,
}));

jest.mock('./SwapStockTradeProvider', () => ({
  SwapStockTradeProvider: ({ children }: IPrimitiveProps) => children,
  useSwapStockTradeContext: () => mockClosedStockChannel,
}));

const containerProps: ISwapStockDesktopContainerProps = {
  alerts: { quoteId: '', states: [] },
  displayQuoteResult: mockQuoteResult,
  fetchLoading: false,
  onBalanceMaxPress: jest.fn(),
  onOpenProviderList: jest.fn(),
  onPreSwap: jest.fn(),
  onSelectPercentageStage: jest.fn(),
  onSelectToken: jest.fn(),
  onToAnotherAddressModal: jest.fn(),
  quoteEventFetching: false,
  quoteLoading: true,
  quoteResult: mockQuoteResult,
  refreshAction: jest.fn(),
  storeName: 'swap' as ISwapStockDesktopContainerProps['storeName'],
  supportNetworksList: [],
};

describe('SwapStockMobileContainer closed-market wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSwapStockAmountInputState.mockReturnValue({
      amountFiatValue: '$1',
      balanceFailed: false,
      balanceLoading: false,
      balanceReadyForExecution: false,
      currencySymbol: '$',
      disableNativePayToken: false,
      displayBalance: '12.5',
      hasBalanceError: false,
      inputEditable: true,
      inputToken: mockPayToken,
      inputTokenNetworkLogoURI: 'network-logo',
      inputValue: '1',
      isBuySide: true,
      onAmountChange: jest.fn(),
      onBalanceMaxPress: jest.fn(),
      onBalanceRetry: jest.fn(),
      onSelectPercentageStage: jest.fn(),
      payToken: mockPayToken,
      payTokenOptionsLoading: false,
      payTokens: [mockPayToken],
      selectablePayTokens: [mockPayToken],
      selectPayToken: jest.fn(),
      shouldRenderSkeleton: false,
    });
  });

  it('keeps AmountInput editable and settles EstimatedReceive without a skeleton', () => {
    render(<SwapStockMobileContainer {...containerProps} />);

    expect(mockUseSwapStockAmountInputState).toHaveBeenCalledWith({
      stockChannel: mockClosedStockChannel,
    });
    expect(mockAmountInput).toHaveBeenCalledTimes(1);
    const amountInputProps = mockAmountInput.mock
      .calls[0]?.[0] as IAmountInputProps;
    expect(amountInputProps.inputProps?.readonly).toBe(false);
    expect(
      screen.getByTestId('wired-stock-amount-input').getAttribute('readonly'),
    ).toBeNull();

    const estimatedReceive = screen.getByTestId('swap-stock-estimated-receive');
    expect(
      within(estimatedReceive).queryByTestId('stock-ui-skeleton'),
    ).toBeNull();
    expect(within(estimatedReceive).getByText('--')).toBeTruthy();
  });
});
