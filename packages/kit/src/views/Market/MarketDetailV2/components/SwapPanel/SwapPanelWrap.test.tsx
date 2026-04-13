/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';

import { SwapPanelWrap } from './SwapPanelWrap';

const showDialogMock = jest.fn();
const prepareMarketSwapReviewMock = jest.fn();
const useSpeedSwapActionsMock = jest.fn();
const swapPanelContentMock = jest.fn();
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
    resetAmounts: jest.fn(),
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
    isLoading,
    onSwap,
    onWrappedSwap,
  }: {
    isLoading: boolean;
    onSwap: () => void;
    onWrappedSwap: () => void;
  }) => (
    <div>
      {swapPanelContentMock({ isLoading, onSwap, onWrappedSwap })}
      <button
        data-testid="swap-action"
        disabled={isLoading}
        onClick={onSwap}
        type="button"
      >
        swap
      </button>
      <button
        data-testid="wrap-action"
        disabled={isLoading}
        onClick={onWrappedSwap}
        type="button"
      >
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
    swapPanelContentMock.mockReset();
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

  it('keeps the action button loading while opening the review and prevents duplicate requests', async () => {
    let resolveReview:
      | ((value: {
          steps: unknown[];
          preSwapData: Record<string, never>;
          quoteResult: undefined;
        }) => void)
      | undefined;

    prepareMarketSwapReviewMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReview = resolve;
        }),
    );

    render(<SwapPanelWrap />);

    fireEvent.click(screen.getByTestId('swap-action'));

    await waitFor(() => {
      expect(swapPanelContentMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isLoading: true,
        }),
      );
    });

    fireEvent.click(screen.getByTestId('swap-action'));

    expect(prepareMarketSwapReviewMock).toHaveBeenCalledTimes(1);
    expect(showDialogMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveReview?.({
        steps: [],
        preSwapData: {},
        quoteResult: undefined,
      });
    });

    await waitFor(() => {
      expect(showDialogMock).toHaveBeenCalledTimes(1);
    });
    expect(swapPanelContentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isLoading: false,
      }),
    );
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

  it('keeps the new review dialog state when the previous dialog closes later', async () => {
    const firstDialog = {
      close: jest.fn(),
    };
    const secondDialog = {
      close: jest.fn(),
    };

    showDialogMock
      .mockReturnValueOnce(firstDialog)
      .mockReturnValueOnce(secondDialog);

    render(<SwapPanelWrap />);

    fireEvent.click(screen.getByTestId('swap-action'));

    await waitFor(() => {
      expect(showDialogMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(
        useSpeedSwapActionsMock.mock.calls.at(-1)?.[0]?.isReviewDialogOpen,
      ).toBe(true);
    });

    fireEvent.click(screen.getByTestId('swap-action'));

    await waitFor(() => {
      expect(showDialogMock).toHaveBeenCalledTimes(2);
    });
    expect(firstDialog.close).toHaveBeenCalledTimes(1);

    const firstOnClose = showDialogMock.mock.calls[0]?.[0]?.onClose as
      | (() => void)
      | undefined;
    const secondOnClose = showDialogMock.mock.calls[1]?.[0]?.onClose as
      | (() => void)
      | undefined;

    await act(async () => {
      firstOnClose?.();
    });

    await waitFor(() => {
      expect(
        useSpeedSwapActionsMock.mock.calls.at(-1)?.[0]?.isReviewDialogOpen,
      ).toBe(true);
    });

    await act(async () => {
      secondOnClose?.();
    });

    await waitFor(() => {
      expect(
        useSpeedSwapActionsMock.mock.calls.at(-1)?.[0]?.isReviewDialogOpen,
      ).toBe(false);
    });
  });
});
