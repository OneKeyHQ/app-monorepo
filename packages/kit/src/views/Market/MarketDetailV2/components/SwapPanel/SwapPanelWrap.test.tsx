/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';

import { SwapPanelWrap } from './SwapPanelWrap';

const showDialogMock = jest.fn();
const prepareMarketSwapReviewMock = jest.fn();
const useSpeedSwapActionsMock = jest.fn();
let mockSpeedCheckLoading = false;
let mockCheckTokenAllowanceLoading = false;
let mockSwapApprovingMatchLoading = false;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  EInPageDialogType: {
    inModalPage: 'inModalPage',
    inTabPages: 'inTabPages',
  },
  Toast: {
    error: jest.fn(),
  },
  useInPageDialog: () => ({
    show: showDialogMock,
  }),
  useIsOverlayPage: () => false,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/hooks/useCustomRpcAvailability', () => ({
  useCustomRpcAvailability: () => ({
    isCustomRpcUnavailable: true,
  }),
}));

jest.mock('../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    networkId: 'evm--1',
    isReady: true,
    tokenDetail: {
      address: '0xmarket',
      symbol: 'BTC',
      decimals: 8,
      logoUrl: 'logo',
      price: '100',
      isNative: false,
      supportSwap: {
        enable: true,
      },
    },
  }),
}));

jest.mock('./hooks/useSwapPanel', () => ({
  useSwapPanel: () => ({
    networkId: 'evm--1',
    setPaymentToken: jest.fn(),
    paymentToken: {
      networkId: 'evm--1',
      contractAddress: '0xpay',
      symbol: 'USDC',
      decimals: 6,
      price: '1',
      isNative: false,
    },
    paymentAmount: {
      toFixed: () => '1',
    },
    sellAmount: {
      toFixed: () => '1',
    },
    tradeType: 'buy',
    setSlippage: jest.fn(),
    slippage: 1,
  }),
}));

jest.mock('./hooks/useSpeedSwapInit', () => ({
  useSpeedSwapInit: () => ({
    isLoading: false,
    speedConfig: {
      spenderAddress: '0xspender',
      slippage: 1,
    },
    supportSpeedSwap: true,
    onlySupportCrossChain: false,
    defaultTokens: [
      {
        networkId: 'evm--1',
        contractAddress: '0xpay',
        symbol: 'USDC',
        decimals: 6,
        price: '1',
        isNative: false,
      },
    ],
    provider: 'onekey',
    swapMevNetConfig: [],
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: undefined,
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: {
        id: 'account-1',
      },
      wallet: {
        id: 'wallet-1',
      },
    },
  }),
}));

jest.mock('./hooks/useSpeedSwapActions', () => ({
  useSpeedSwapActions: (...args: unknown[]) => {
    useSpeedSwapActionsMock(...args);
    return {
      speedSwapBuildTxLoading: false,
      swapApprovingMatchLoading: mockSwapApprovingMatchLoading,
      checkTokenAllowanceLoading: mockCheckTokenAllowanceLoading,
      balance: {
        gte: () => true,
      },
      balanceToken: {
        networkId: 'evm--1',
        contractAddress: '0xpay',
        symbol: 'USDC',
        decimals: 6,
        price: '1',
        isNative: false,
      },
      fetchBalanceLoading: false,
      priceRate: undefined,
      swapNativeTokenReserveGas: [],
      isWrapped: false,
      speedCheckError: '',
      speedCheckLoading: mockSpeedCheckLoading,
      prepareMarketSwapReview: prepareMarketSwapReviewMock,
      sendMarketApproveTx: jest.fn(),
      sendMarketSwapTx: jest.fn(),
      sendMarketWrappedTx: jest.fn(),
      sendMarketSignMessage: jest.fn(),
      buildMarketApproveInfos: jest.fn(),
    };
  },
}));

jest.mock('./MarketSwapReviewDialog', () => ({
  MarketSwapReviewDialog: () => <div data-testid="market-review-dialog" />,
}));

jest.mock('./SwapPanelContent', () => ({
  SwapPanelContent: ({
    onSwap,
    onWrappedSwap,
  }: {
    onSwap: () => void;
    onWrappedSwap: () => void;
  }) => (
    <div>
      <button data-testid="swap-action" onClick={onSwap} type="button">
        swap
      </button>
      <button data-testid="wrap-action" onClick={onWrappedSwap} type="button">
        wrap
      </button>
    </div>
  ),
}));

describe('SwapPanelWrap', () => {
  beforeEach(() => {
    showDialogMock.mockReset();
    prepareMarketSwapReviewMock.mockReset();
    useSpeedSwapActionsMock.mockReset();
    (Toast.error as jest.Mock).mockReset();
    mockSpeedCheckLoading = false;
    mockCheckTokenAllowanceLoading = false;
    mockSwapApprovingMatchLoading = false;
    showDialogMock.mockReturnValue({
      close: jest.fn(),
    });
    prepareMarketSwapReviewMock.mockResolvedValue({
      steps: [],
      preSwapData: {},
      quoteResult: undefined,
    });
  });

  it('opens the market review dialog for the regular swap path', async () => {
    render(<SwapPanelWrap />);

    expect(useSpeedSwapActionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isCustomRpcUnavailable: true,
      }),
    );

    fireEvent.click(screen.getByTestId('swap-action'));

    await waitFor(() => {
      expect(prepareMarketSwapReviewMock).toHaveBeenCalledWith({
        isWrap: false,
        networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
      });
    });
    expect(showDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: ETranslations.global_review_order,
      }),
    );
  });

  it('opens the market review dialog for the wrap path', async () => {
    render(<SwapPanelWrap />);

    fireEvent.click(screen.getByTestId('wrap-action'));

    await waitFor(() => {
      expect(prepareMarketSwapReviewMock).toHaveBeenCalledWith({
        isWrap: true,
        networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM,
      });
    });
    expect(showDialogMock).toHaveBeenCalledTimes(1);
  });

  it('does not open the preview while action state is still loading', () => {
    mockSpeedCheckLoading = true;

    render(<SwapPanelWrap />);

    fireEvent.click(screen.getByTestId('swap-action'));

    expect(prepareMarketSwapReviewMock).not.toHaveBeenCalled();
    expect(showDialogMock).not.toHaveBeenCalled();
  });

  it('does not open the preview while approve is pending', () => {
    mockSwapApprovingMatchLoading = true;

    render(<SwapPanelWrap />);

    fireEvent.click(screen.getByTestId('swap-action'));

    expect(prepareMarketSwapReviewMock).not.toHaveBeenCalled();
    expect(showDialogMock).not.toHaveBeenCalled();
  });

  it('uses a translation key fallback when review opening throws a non-error value', async () => {
    prepareMarketSwapReviewMock.mockRejectedValueOnce('unknown failure');

    render(<SwapPanelWrap />);

    fireEvent.click(screen.getByTestId('swap-action'));

    await waitFor(() => {
      expect(Toast.error).toHaveBeenCalledWith({
        title: ETranslations.global_unknown_error,
      });
    });
  });
});
