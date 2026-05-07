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

jest.mock('@onekeyhq/components', () => ({
  SizableText: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Toast: {
    message: jest.fn(),
  },
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

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
        }: {
          tradeType: ESwapDirection;
        },
        ref,
      ) => {
        const React = jest.requireActual<typeof import('react')>('react');
        const setValue = jest.fn();
        React.useImperativeHandle(ref, () => ({
          setValue,
        }));
        tokenInputSectionMock({ tradeType, setValue });
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
  ActionButton: (props: { onPress: () => void; disabled?: boolean }) => {
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
    onWrappedSwap: jest.fn(),
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
    speedCheckError: '',
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

    expect(props.onSwap).toHaveBeenCalledTimes(1);
  });

  it('routes wrapped pairs through the wrapped review handler', () => {
    const props = createProps();
    props.isWrapped = true;

    render(<SwapPanelContent {...props} />);

    fireEvent.click(screen.getByTestId('action-button'));

    expect(props.onWrappedSwap).toHaveBeenCalledTimes(1);
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
