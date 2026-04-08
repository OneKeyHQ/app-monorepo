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
    setAmountEnterType: jest.fn(),
    logSwapAction: jest.fn(),
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
  TokenInputSection: () => <div data-testid="token-input" />,
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

jest.mock('./components/ActionButton', () => ({
  ActionButton: ({
    disabled,
    onPress,
  }: {
    onPress: () => void;
    disabled?: boolean;
  }) => {
    actionButtonMock({ disabled, onPress });
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
  });

  it('routes the main action button to the review swap handler', () => {
    const props = createProps();

    render(<SwapPanelContent {...props} />);

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
});
