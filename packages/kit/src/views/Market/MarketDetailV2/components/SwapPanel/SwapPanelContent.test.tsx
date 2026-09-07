/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import BigNumber from 'bignumber.js';

import { ESwapDirection } from './hooks/useTradeType';
import {
  type ISwapPanelContentProps,
  SwapPanelContent,
} from './SwapPanelContent';

const actionButtonMock = jest.fn();
const setAmountEnterTypeMock = jest.fn();
const setSlippageSettingMock = jest.fn();
const resetAnalyticsMock = jest.fn();
const logSwapActionMock = jest.fn();
const tokenInputSectionMock = jest.fn();
const swapProviderInfoItemMock = jest.fn();
const swapRateDifferenceTextMock = jest.fn();
const swapActionsStateMock = jest.fn();
const swapQuoteResultMock = jest.fn();
const swapStockHeaderRightActionContainerMock = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Icon: () => <span data-testid="icon" />,
  NumberSizeableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  SizableText: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  Skeleton: () => <span data-testid="skeleton" />,
  XStack: ({
    children,
    height,
    pb,
    pt,
    testID,
  }: {
    children?: ReactNode;
    height?: number | string;
    pb?: number | string;
    pt?: number | string;
    testID?: string;
  }) => (
    <div data-height={height} data-pb={pb} data-pt={pt} data-testid={testID}>
      {children}
    </div>
  ),
  YStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
  Toast: {
    message: jest.fn(),
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Swap/components/SwapProviderInfoItem',
  () => ({
    __esModule: true,
    default: (props: { testID?: string }) => {
      swapProviderInfoItemMock(props);
      return <div data-testid={props.testID ?? 'provider-info'} />;
    },
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Swap/components/SwapRateDifferenceText',
  () => ({
    SwapRateDifferenceText: (props: { rateDifference?: { value: string } }) => {
      swapRateDifferenceTextMock(props);
      return (
        <span data-testid="rate-difference">{props.rateDifference?.value}</span>
      );
    },
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Swap/pages/components/SwapActionsState',
  () => ({
    __esModule: true,
    default: (props: unknown) => {
      swapActionsStateMock(props);
      return <div data-testid="swap-actions-state" />;
    },
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Swap/pages/components/SwapQuoteResult',
  () => ({
    __esModule: true,
    default: (props: unknown) => {
      swapQuoteResultMock(props);
      return <div data-testid="swap-quote-result" />;
    },
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Swap/pages/components/SwapHeaderRightActionContainer',
  () => ({
    SwapStockHeaderRightActionContainer: (props: unknown) => {
      swapStockHeaderRightActionContainerMock(props);
      return <div data-testid="stock-header-actions" />;
    },
  }),
);

jest.mock('./hooks/useSwapAnalytics', () => ({
  useSwapAnalytics: () => ({
    setAmountEnterType: setAmountEnterTypeMock,
    setSlippageSetting: setSlippageSettingMock,
    resetAnalytics: resetAnalyticsMock,
    logSwapAction: logSwapActionMock,
  }),
}));

jest.mock('./components/TradeTypeSelector', () => ({
  TradeTypeSelector: () => <div data-testid="trade-type" />,
}));

jest.mock('../TokenSelector/StockTokenVariantSelector', () => ({
  StockTokenVariantSelector: () => (
    <div data-testid="stock-token-variant-selector" />
  ),
}));

jest.mock('../StockTokenInfo/StockTokenInfoPopover', () => ({
  StockTokenInfoPopover: () => <div data-testid="stock-token-info-popover" />,
}));

jest.mock('@onekeyhq/kit/src/views/Market/components/MarketTokenPrice', () => ({
  BaseMarketTokenPrice: () => <div data-testid="market-token-price" />,
}));

jest.mock('./components/SwapPanelTop', () => ({
  __esModule: true,
  default: () => <div data-testid="panel-top" />,
}));

jest.mock('./components/TokenInputSection', () => ({
  TokenInputSection: jest
    .requireActual<typeof import('react')>('react')
    .forwardRef(
      (
        {
          tradeType,
          stockDetailDesktopLayout,
        }: {
          tradeType: ESwapDirection;
          stockDetailDesktopLayout?: boolean;
        },
        ref,
      ) => {
        const React = jest.requireActual<typeof import('react')>('react');
        const setValue = jest.fn();
        React.useImperativeHandle(ref, () => ({
          setValue,
        }));
        tokenInputSectionMock({
          tradeType,
          stockDetailDesktopLayout,
          setValue,
        });
        return <div data-testid="token-input" />;
      },
    ),
}));

jest.mock('./components/RateDisplay', () => ({
  RateDisplay: () => <div data-testid="rate-display" />,
}));

jest.mock('./components/SellForSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="sell-selector" />,
}));

jest.mock('./components/SlippageSetting', () => ({
  SlippageSetting: () => <div data-testid="slippage" />,
}));

jest.mock('./components/MarketPresetSelector', () => ({
  MarketPresetSelector: () => <div data-testid="market-preset-selector" />,
}));

jest.mock('./components/ActionButton', () => ({
  ActionButton: (props: {
    onPress: () => void;
    onSwapAction?: () => void;
    disabled?: boolean;
  }) => {
    const { disabled, onPress } = props;
    actionButtonMock(props);
    return (
      <button
        data-testid="action-button"
        disabled={disabled}
        onClick={onPress}
        type="button"
      >
        action
      </button>
    );
  },
}));

function createProps(): ISwapPanelContentProps {
  return {
    activeAccount: {
      account: {
        id: 'account-1',
      } as never,
    } as never,
    enableAddressTypeSelector: false,
    swapPanel: {
      paymentAmount: new BigNumber(1),
      paymentToken: {
        networkId: 'evm--1',
        contractAddress: '0xpay',
        symbol: 'USDC',
        decimals: 6,
        speedSwapDefaultAmount: [],
      },
      sellAmount: new BigNumber(1),
      setSellAmount: jest.fn(),
      setPaymentAmount: jest.fn(),
      resetAmounts: jest.fn(),
      setPaymentToken: jest.fn(),
      tradeType: ESwapDirection.BUY,
      setTradeType: jest.fn(),
      setSlippage: jest.fn(),
      slippage: 1,
      setNetworkId: jest.fn(),
      networkId: 'evm--1',
    },
    isLoading: false,
    balanceLoading: false,
    slippageAutoValue: 1,
    supportSpeedSwap: {
      enabled: true,
      isAccountNetworkSupported: true,
      onlySupportCrossChain: false,
    },
    defaultTokens: [],
    balance: new BigNumber(10),
    balanceToken: {
      networkId: 'evm--1',
      contractAddress: '0xpay',
      symbol: 'USDC',
      decimals: 6,
      isNative: false,
      price: '1',
      speedSwapDefaultAmount: [],
    },
    onSwap: jest.fn(),
    onOpenRecipientAddress: jest.fn(),
    onWrappedSwap: jest.fn(),
    onRefreshQuote: jest.fn(),
    onForceRefreshQuote: jest.fn(),
    swapMevNetConfig: [],
    swapNativeTokenReserveGas: [],
    isWrapped: false,
    priceRate: undefined,
    hasInitialReady: true,
    currentMarketToken: {
      networkId: 'evm--1',
      contractAddress: '0xmarket',
      symbol: 'BTC',
      decimals: 8,
      isNative: false,
    },
    quoteListLength: 0,
    onOpenProviderList: jest.fn(),
    quoteError: '',
  };
}

describe('SwapPanelContent', () => {
  beforeEach(() => {
    actionButtonMock.mockReset();
    setAmountEnterTypeMock.mockReset();
    setSlippageSettingMock.mockReset();
    resetAnalyticsMock.mockReset();
    logSwapActionMock.mockReset();
    tokenInputSectionMock.mockReset();
    swapProviderInfoItemMock.mockReset();
    swapRateDifferenceTextMock.mockReset();
    swapActionsStateMock.mockReset();
    swapQuoteResultMock.mockReset();
    swapStockHeaderRightActionContainerMock.mockReset();
  });

  it('routes the main action button to the review swap handler', () => {
    const props = createProps();

    render(<SwapPanelContent {...props} />);

    expect(actionButtonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentToken: props.swapPanel.paymentToken,
      }),
    );

    fireEvent.click(screen.getByTestId('action-button'));
    const actionProps = actionButtonMock.mock.lastCall?.[0] as {
      onSwapAction?: () => void;
    };
    actionProps.onSwapAction?.();

    expect(props.onSwap).toHaveBeenCalledTimes(1);
    expect(logSwapActionMock).toHaveBeenCalledWith({
      tradeType: props.swapPanel.tradeType,
      networkId: props.swapPanel.networkId,
      paymentToken: props.swapPanel.paymentToken,
      marketToken: props.currentMarketToken,
    });
  });

  it('uses the dedicated Figma trading ticket on stock desktop detail', () => {
    const props = createProps();
    props.stockDetailDesktopLayout = true;

    render(<SwapPanelContent {...props} />);

    expect(screen.getByTestId('stock-trade-target')).toBeTruthy();
    expect(screen.getByTestId('stock-trade-estimated-received')).toBeTruthy();
    expect(screen.queryByTestId('market-token-selector')).toBeNull();
    expect(screen.queryByTestId('panel-top')).toBeNull();
    expect(screen.queryByTestId('rate-display')).toBeNull();
    expect(screen.getByTestId('stock-trade-estimated-shares')).toBeTruthy();
    expect(screen.getByTestId('swap-quote-result')).toBeTruthy();
    expect(screen.getByTestId('stock-header-actions')).toBeTruthy();
    expect(swapStockHeaderRightActionContainerMock).toHaveBeenCalledWith({
      storeName: 'marketSwap',
    });
    expect(
      screen
        .getByTestId('stock-trade-estimated-received')
        .querySelector('[data-testid="icon"]'),
    ).toBeNull();

    expect(tokenInputSectionMock).toHaveBeenCalledTimes(2);
    expect(tokenInputSectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ stockDetailDesktopLayout: true }),
    );
    expect(actionButtonMock).not.toHaveBeenCalled();
    expect(swapActionsStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onOpenRecipientAddress: props.onOpenRecipientAddress,
        onRefreshQuote: expect.any(Function),
        onPreSwap: expect.any(Function),
      }),
    );
  });

  it('routes the shared Trade review action through the Market review flow', () => {
    const props = createProps();
    props.stockDetailDesktopLayout = true;

    render(<SwapPanelContent {...props} />);

    const actionProps = swapActionsStateMock.mock.lastCall?.[0] as {
      onPreSwap: () => void;
      onRefreshQuote: () => void;
    };
    actionProps.onPreSwap();
    actionProps.onRefreshQuote();

    expect(props.onSwap).toHaveBeenCalledTimes(1);
    expect(props.onRefreshQuote).toHaveBeenCalledWith(true);
    expect(logSwapActionMock).toHaveBeenCalledWith({
      tradeType: props.swapPanel.tradeType,
      networkId: props.swapPanel.networkId,
      paymentToken: props.swapPanel.paymentToken,
      marketToken: props.currentMarketToken,
    });
  });

  it('renders live stock quote values and delegates rate and provider details to Swap', () => {
    const props = createProps();
    props.stockDetailDesktopLayout = true;
    props.stockTokenToAssetRatio = '0.9985';
    props.stockUnderlyingSymbol = 'AAPL';
    props.quoteListLength = 2;
    props.stockQuoteDisplay = {
      currencySymbol: '$',
      receiveFiatValue: '99.789',
      rateDifference: {
        value: '-0.21%',
        unit: 'negative' as never,
      },
    };
    props.quoteResult = {
      info: {
        provider: 'liquidMesh',
        providerLogo: 'https://example.com/provider.png',
        providerName: 'liquidMesh',
      },
      isBest: true,
      fromAmount: '100',
      toAmount: '0.3219',
      fromTokenInfo: {
        networkId: 'evm--1',
        contractAddress: '0xpay',
        symbol: 'USDC',
        decimals: 6,
      },
      toTokenInfo: {
        networkId: 'evm--1',
        contractAddress: '0xmarket',
        symbol: 'AAPLon',
        decimals: 18,
      },
    };

    render(<SwapPanelContent {...props} />);

    expect(screen.getByText('0.3219')).toBeTruthy();
    expect(screen.getByText('AAPLon')).toBeTruthy();
    expect(screen.getByText('99.789')).toBeTruthy();
    expect(screen.getByText('-0.21%')).toBeTruthy();
    expect(screen.getByText('0.32141715')).toBeTruthy();
    expect(screen.getByText('AAPL')).toBeTruthy();
    const estimatedSharesRow = screen.getByTestId(
      'stock-trade-estimated-shares',
    );
    expect(estimatedSharesRow.getAttribute('data-pb')).toBe('$2');
    expect(estimatedSharesRow.getAttribute('data-pt')).toBe('$0');
    expect(estimatedSharesRow.hasAttribute('data-height')).toBe(false);
    expect(swapQuoteResultMock).toHaveBeenCalledWith(
      expect.objectContaining({
        onOpenProviderList: props.onOpenProviderList,
        quoteResult: props.quoteResult,
        refreshAction: props.onForceRefreshQuote,
      }),
    );
    expect(swapProviderInfoItemMock).not.toHaveBeenCalled();
  });

  it('keeps the shares row visible without fabricating a value', () => {
    const props = createProps();
    props.stockDetailDesktopLayout = true;
    props.quoteResult = {
      info: {
        provider: 'liquidMesh',
        providerName: 'liquidMesh',
      },
      fromTokenInfo: props.swapPanel.paymentToken!,
      toTokenInfo: props.currentMarketToken as never,
      toAmount: '0.3219',
    };

    render(<SwapPanelContent {...props} />);

    expect(
      screen.getByTestId('stock-trade-estimated-shares').textContent,
    ).toContain('--');
  });

  it('keeps the shared Connect wallet action enabled without an account', () => {
    const props = createProps();
    props.stockDetailDesktopLayout = true;
    props.activeAccount = {} as never;
    props.isActionDisabled = true;

    render(<SwapPanelContent {...props} />);

    expect(swapActionsStateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        forceNoConnectWallet: true,
        disabled: false,
        forceQuoteActionLoading: false,
      }),
    );
  });

  it('preserves the full Swap fallback when speed swap is unsupported', () => {
    const props = createProps();
    props.stockDetailDesktopLayout = true;
    props.supportSpeedSwap.enabled = false;

    render(<SwapPanelContent {...props} />);

    expect(swapActionsStateMock).not.toHaveBeenCalled();
    expect(actionButtonMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        supportSpeedSwap: false,
        isAccountNetworkSupported: true,
      }),
    );
  });

  it('disables stock trading until a token variant identity is available', () => {
    const props = createProps();
    props.stockDetailDesktopLayout = true;
    expect(props.currentMarketToken).toBeDefined();
    if (!props.currentMarketToken) {
      return;
    }
    props.currentMarketToken.networkId = '';
    props.currentMarketToken.contractAddress = '';

    render(<SwapPanelContent {...props} />);

    expect(swapActionsStateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('routes wrapped pairs through the wrapped review handler', () => {
    const props = createProps();
    props.isWrapped = true;

    render(<SwapPanelContent {...props} />);

    fireEvent.click(screen.getByTestId('action-button'));

    expect(props.onWrappedSwap).toHaveBeenCalledTimes(1);
  });

  it('routes an expired quote action to refresh without opening review', () => {
    const props = createProps();
    props.isRefreshQuote = true;
    props.onRefreshQuote = jest.fn();

    render(<SwapPanelContent {...props} />);

    fireEvent.click(screen.getByTestId('action-button'));

    expect(props.onRefreshQuote).toHaveBeenCalledTimes(1);
    expect(props.onSwap).not.toHaveBeenCalled();
    expect(actionButtonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isRefreshQuote: true,
        onSwapAction: undefined,
      }),
    );
  });

  it('disables the preview entry while loading', () => {
    const props = createProps();
    props.isLoading = true;

    render(<SwapPanelContent {...props} />);

    const actionButton = screen.getByTestId('action-button');

    expect((actionButton as HTMLButtonElement).disabled).toBe(true);
    expect(actionButtonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: true,
        loading: true,
      }),
    );
  });
  it('disables the preview entry without showing loading for guarded states', () => {
    const props = createProps();
    props.isActionDisabled = true;

    render(<SwapPanelContent {...props} />);

    const actionButton = screen.getByTestId('action-button');

    expect((actionButton as HTMLButtonElement).disabled).toBe(true);
    expect(actionButtonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: true,
        loading: false,
      }),
    );
  });

  it('resets panel state when the market token changes', () => {
    const props = createProps();
    const { rerender } = render(<SwapPanelContent {...props} />);

    expect(props.swapPanel.resetAmounts).not.toHaveBeenCalled();
    expect(resetAnalyticsMock).not.toHaveBeenCalled();

    tokenInputSectionMock.mockClear();

    rerender(
      <SwapPanelContent
        {...props}
        currentMarketToken={{
          networkId: 'evm--10',
          contractAddress: '0xmarket-2',
          symbol: 'ETH',
          decimals: 18,
          isNative: true,
        }}
      />,
    );

    expect(props.swapPanel.resetAmounts).toHaveBeenCalledTimes(1);
    expect(resetAnalyticsMock).toHaveBeenCalledTimes(1);

    const renderedInputs = tokenInputSectionMock.mock.calls.map(
      ([renderedProps]) =>
        renderedProps as {
          setValue: jest.Mock;
        },
    );
    expect(renderedInputs).toHaveLength(2);
    expect(renderedInputs[0].setValue).toHaveBeenCalledWith('');
    expect(renderedInputs[1].setValue).toHaveBeenCalledWith('');
  });

  it('uses Market preset settings instead of the standalone slippage setting', () => {
    const props = createProps();
    props.marketPresetSettings = {
      config: undefined,
      enabled: true,
      isLoading: false,
      presets: [],
      presetCustomizedMap: {},
      priorityFeeUnit: 'Gwei',
      savedSettings: undefined,
      selectedPresetKey: 'auto',
      selectedPreset: undefined,
      selectedDirectionSettings: {
        slippage: {
          key: 'auto',
        },
        priorityFee: {
          type: 'market',
        },
      },
      selectedNetworkFeeLevel: 'medium',
      selectedSlippageValue: 0.5,
      defaultSlippageValue: 0.5,
      tradeSide: 'buy',
      onPresetChange: jest.fn(),
      onSavePresetDirectionSettings: jest.fn(),
      onResetPresetDirectionSettings: jest.fn(),
      getDirectionSettings: jest.fn(),
      getSavedDirectionSettings: jest.fn(),
    } as never;

    render(<SwapPanelContent {...props} />);

    expect(screen.getByTestId('market-preset-selector')).toBeTruthy();
    expect(screen.queryByTestId('slippage')).toBeNull();
  });

  it('uses Trade-Stock settings and history instead of Market presets on stock desktop', () => {
    const props = createProps();
    props.stockDetailDesktopLayout = true;
    props.marketPresetSettings = {
      enabled: true,
      isLoading: false,
      presets: [],
    } as never;

    render(<SwapPanelContent {...props} />);

    expect(screen.getByTestId('stock-header-actions')).toBeTruthy();
    expect(screen.queryByTestId('market-preset-selector')).toBeNull();
    expect(screen.queryByTestId('slippage')).toBeNull();
  });

  it('suppresses the standalone slippage setting while Market preset config is loading', () => {
    const props = createProps();
    props.marketPresetSettings = {
      enabled: false,
      isLoading: true,
    } as never;

    render(<SwapPanelContent {...props} />);

    expect(screen.queryByTestId('market-preset-selector')).toBeNull();
    expect(screen.queryByTestId('slippage')).toBeNull();
  });
});
