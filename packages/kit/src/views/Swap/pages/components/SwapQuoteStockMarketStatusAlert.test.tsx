/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { SwapQuoteStockMarketStatusAlert } from './SwapQuoteStockMarketStatusAlert';

const mockNavigateToPerps = jest.fn();
const mockAlert = jest.fn((_props: unknown) => null);
type IMockStockMarketStatusAlertProps = {
  onTradePerps?: () => void;
  statusCase: unknown;
  timeText?: string;
};
type IMockStockTokenDetailParams = {
  enabled: boolean;
  requireCurrentActivation?: boolean;
  token?: ISwapToken;
};
type IMockStockTokenDetailResult = {
  displayTokenDetail?: unknown;
  fetchedAt?: number;
  latestFetchSucceeded?: boolean;
  pending: boolean;
  perpsInfo?: { hlTicker: string };
  tokenDetail?: {
    stock?: {
      description?: string;
      isOpen?: boolean;
      isPaused?: boolean;
    };
  };
};
const mockStockMarketStatusAlert = jest.fn(
  (_props: IMockStockMarketStatusAlertProps) => null,
);
const mockResolveStockMarketStatusCase = jest.fn(
  (params: { hasOpenTime: boolean; hasPerps: boolean; isOpen?: boolean }) =>
    JSON.stringify(params),
);
const mockUseSwapStockTokenDetail = jest.fn(
  (_params: IMockStockTokenDetailParams): IMockStockTokenDetailResult => ({
    pending: false,
  }),
);

const mockUsdcToken: ISwapToken = {
  contractAddress: '0xusdc',
  decimals: 6,
  networkId: 'evm--1',
  symbol: 'USDC',
};
const mockStockToken: ISwapToken = {
  contractAddress: '0xstock',
  decimals: 18,
  isStock: true,
  networkId: 'evm--1',
  symbol: 'AAPLon',
};
type IMockQuoteEventError = {
  fromToken: ISwapToken;
  fromTokenAmount: string;
  isMarketOpen?: boolean;
  isStock?: boolean;
  message: string;
  toToken: ISwapToken;
};
const mockSwapState: {
  fromAmount: { isInput: boolean; value: string };
  fromToken?: ISwapToken;
  quoteEventCompleted: boolean;
  quoteEventError?: IMockQuoteEventError;
  swapType: ESwapTabSwitchType;
  toToken?: ISwapToken;
} = {
  fromAmount: {
    isInput: true,
    value: '2',
  },
  fromToken: mockUsdcToken as ISwapToken | undefined,
  quoteEventCompleted: true,
  quoteEventError: {
    fromToken: mockUsdcToken,
    fromTokenAmount: '2',
    isMarketOpen: false,
    isStock: true,
    message: 'Market closed',
    toToken: mockStockToken,
  },
  swapType: ESwapTabSwitchType.SWAP,
  toToken: mockStockToken as ISwapToken | undefined,
};
let mockStockDetailResult: IMockStockTokenDetailResult;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Alert: (props: unknown) => mockAlert(props),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapFromTokenAmountAtom: () => [mockSwapState.fromAmount],
  useSwapQuoteEventCompletedAtom: () => [mockSwapState.quoteEventCompleted],
  useSwapQuoteEventErrorAtom: () => [mockSwapState.quoteEventError],
  useSwapSelectFromTokenAtom: () => [mockSwapState.fromToken],
  useSwapSelectToTokenAtom: () => [mockSwapState.toToken],
  useSwapTypeSwitchAtom: () => [mockSwapState.swapType],
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/components/StockMarketStatusAlert',
  () => ({
    StockMarketStatusAlert: (props: IMockStockMarketStatusAlertProps) =>
      mockStockMarketStatusAlert(props),
    getStockMarketClosedDescription: (reason?: string) =>
      reason?.split(/\r?\n/)[0]?.trim() || undefined,
    resolveStockMarketStatusCase: (params: {
      hasOpenTime: boolean;
      hasPerps: boolean;
      isOpen?: boolean;
    }) => mockResolveStockMarketStatusCase(params),
  }),
);

jest.mock('@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation', () => ({
  usePerpsNavigation: () => ({
    navigateToPerps: mockNavigateToPerps,
  }),
}));

jest.mock('../../hooks/useSwapStockTokenDetail', () => ({
  useSwapStockTokenDetail: (params: IMockStockTokenDetailParams) =>
    mockUseSwapStockTokenDetail(params),
}));

describe('SwapQuoteStockMarketStatusAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSwapState.fromAmount = {
      isInput: true,
      value: '2',
    };
    mockSwapState.fromToken = mockUsdcToken;
    mockSwapState.toToken = mockStockToken;
    mockSwapState.swapType = ESwapTabSwitchType.SWAP;
    mockSwapState.quoteEventCompleted = true;
    mockSwapState.quoteEventError = {
      fromToken: mockUsdcToken,
      fromTokenAmount: '2',
      isMarketOpen: false,
      isStock: true,
      message: 'Market closed',
      toToken: mockStockToken,
    };
    mockStockDetailResult = {
      fetchedAt: 1,
      latestFetchSucceeded: true,
      pending: false,
      perpsInfo: {
        hlTicker: 'AAPL',
      },
      tokenDetail: {
        stock: {
          description: 'Reopens in 2h\nProvider description',
          isOpen: false,
        },
      },
    };
    mockUseSwapStockTokenDetail.mockImplementation(
      ({ enabled, token }: IMockStockTokenDetailParams) =>
        enabled && token?.isStock
          ? mockStockDetailResult
          : {
              pending: false,
            },
    );
  });

  it.each([ESwapTabSwitchType.SWAP, ESwapTabSwitchType.BRIDGE])(
    'fetches only the identified stock side and renders the enriched alert for %s',
    (swapType) => {
      mockSwapState.swapType = swapType;
      render(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

      expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(1, {
        enabled: false,
        requireCurrentActivation: true,
        token: mockUsdcToken,
      });
      expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(2, {
        enabled: true,
        requireCurrentActivation: true,
        token: mockStockToken,
      });
      expect(mockResolveStockMarketStatusCase).toHaveBeenCalledWith({
        hasOpenTime: true,
        hasPerps: true,
        isOpen: false,
      });

      const alertProps = mockStockMarketStatusAlert.mock.calls[0]?.[0];
      expect(alertProps?.timeText).toBe('Reopens in 2h');

      act(() => {
        alertProps?.onTradePerps?.();
      });
      expect(mockNavigateToPerps).toHaveBeenCalledWith('AAPL');
    },
  );

  it('probes both sides only after a current closed quote when stock identity is missing', () => {
    mockSwapState.toToken = {
      ...mockStockToken,
      isStock: undefined,
    };
    mockSwapState.quoteEventError = {
      ...mockSwapState.quoteEventError!,
      toToken: mockSwapState.toToken,
    };

    render(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(1, {
      enabled: true,
      requireCurrentActivation: true,
      token: mockUsdcToken,
    });
    expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(2, {
      enabled: true,
      requireCurrentActivation: true,
      token: mockSwapState.toToken,
    });
  });

  it('waits for Market detail and renders only the final enriched alert', () => {
    mockStockDetailResult = {
      pending: true,
    };
    const { rerender } = render(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />,
    );

    expect(mockResolveStockMarketStatusCase).not.toHaveBeenCalled();
    expect(mockStockMarketStatusAlert).not.toHaveBeenCalled();

    mockStockDetailResult = {
      fetchedAt: 2,
      latestFetchSucceeded: true,
      pending: false,
      perpsInfo: {
        hlTicker: 'AAPL',
      },
      tokenDetail: {
        stock: {
          description: 'Reopens in 2h',
          isOpen: false,
        },
      },
    };
    rerender(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockStockMarketStatusAlert).toHaveBeenCalledTimes(1);
    expect(mockResolveStockMarketStatusCase).toHaveBeenCalledWith({
      hasOpenTime: true,
      hasPerps: true,
      isOpen: false,
    });
  });

  it('waits for every enabled candidate when the stock side is ambiguous', () => {
    const ambiguousStockToken = {
      ...mockStockToken,
      isStock: undefined,
    };
    mockSwapState.toToken = ambiguousStockToken;
    mockSwapState.quoteEventError = {
      ...mockSwapState.quoteEventError!,
      toToken: ambiguousStockToken,
    };
    mockUseSwapStockTokenDetail.mockImplementation(({ enabled, token }) => {
      if (!enabled) {
        return { pending: false };
      }
      if (token === mockUsdcToken) {
        return { fetchedAt: 1, pending: false };
      }
      return mockStockDetailResult;
    });
    mockStockDetailResult = {
      pending: true,
    };
    const { rerender } = render(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />,
    );

    expect(mockStockMarketStatusAlert).not.toHaveBeenCalled();

    mockStockDetailResult = {
      fetchedAt: 2,
      latestFetchSucceeded: true,
      pending: false,
      tokenDetail: {
        stock: {
          isOpen: false,
        },
      },
    };
    rerender(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockStockMarketStatusAlert).toHaveBeenCalledTimes(1);
  });

  it('uses the generic alert when any ambiguous candidate fails', () => {
    const ambiguousStockToken = {
      ...mockStockToken,
      isStock: undefined,
    };
    mockSwapState.toToken = ambiguousStockToken;
    mockSwapState.quoteEventError = {
      ...mockSwapState.quoteEventError!,
      toToken: ambiguousStockToken,
    };
    mockUseSwapStockTokenDetail.mockImplementation(({ enabled, token }) => {
      if (!enabled) {
        return { pending: false };
      }
      if (token === mockUsdcToken) {
        return {
          fetchedAt: 1,
          latestFetchSucceeded: false,
          pending: false,
        };
      }
      return {
        fetchedAt: 2,
        latestFetchSucceeded: true,
        pending: false,
        perpsInfo: {
          hlTicker: 'AAPL',
        },
        tokenDetail: {
          stock: {
            isOpen: true,
          },
        },
      };
    });

    render(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockResolveStockMarketStatusCase).toHaveBeenCalledWith({
      hasOpenTime: false,
      hasPerps: false,
      isOpen: false,
    });
    expect(mockStockMarketStatusAlert).toHaveBeenCalledTimes(1);
  });

  it('falls back to the generic closed alert after detail resolution fails', () => {
    mockStockDetailResult = {
      pending: true,
    };
    const { rerender } = render(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />,
    );
    expect(mockStockMarketStatusAlert).not.toHaveBeenCalled();

    mockStockDetailResult = {
      pending: false,
    };
    rerender(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockResolveStockMarketStatusCase).toHaveBeenCalledWith({
      hasOpenTime: false,
      hasPerps: false,
      isOpen: false,
    });
    expect(mockStockMarketStatusAlert).toHaveBeenCalledTimes(1);
  });

  it('does not treat last-good open data as a successful current poll', () => {
    mockStockDetailResult = {
      fetchedAt: 1,
      latestFetchSucceeded: false,
      pending: false,
      perpsInfo: {
        hlTicker: 'AAPL',
      },
      tokenDetail: {
        stock: {
          isOpen: true,
        },
      },
    };

    render(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockResolveStockMarketStatusCase).toHaveBeenCalledWith({
      hasOpenTime: false,
      hasPerps: false,
      isOpen: false,
    });
    expect(mockStockMarketStatusAlert).toHaveBeenCalledTimes(1);
  });

  it('keeps the same Market polling activation while a re-quote reconciles', () => {
    const onMarketReopen = jest.fn();
    mockStockDetailResult = {
      fetchedAt: 1,
      latestFetchSucceeded: true,
      pending: false,
      tokenDetail: {
        stock: {
          isOpen: true,
        },
      },
    };
    const { rerender } = render(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={onMarketReopen} />,
    );

    expect(onMarketReopen).toHaveBeenCalledTimes(1);

    mockSwapState.quoteEventCompleted = false;
    mockSwapState.quoteEventError = undefined;
    rerender(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={onMarketReopen} />,
    );
    expect(mockUseSwapStockTokenDetail.mock.calls.at(-1)?.[0]).toMatchObject({
      enabled: true,
      token: mockStockToken,
    });

    mockSwapState.quoteEventError = {
      fromToken: mockUsdcToken,
      fromTokenAmount: '2',
      isMarketOpen: false,
      isStock: true,
      message: 'Market still closed',
      toToken: mockStockToken,
    };
    rerender(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={onMarketReopen} />,
    );
    expect(onMarketReopen).toHaveBeenCalledTimes(1);

    mockStockDetailResult = {
      ...mockStockDetailResult,
      fetchedAt: 2,
    };
    rerender(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={onMarketReopen} />,
    );
    expect(onMarketReopen).toHaveBeenCalledTimes(2);

    mockSwapState.quoteEventError = undefined;
    mockSwapState.quoteEventCompleted = false;
    rerender(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={onMarketReopen} />,
    );
    mockSwapState.quoteEventCompleted = true;
    rerender(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={onMarketReopen} />,
    );
    expect(mockUseSwapStockTokenDetail.mock.calls.at(-1)?.[0]).toMatchObject({
      enabled: false,
      token: mockStockToken,
    });
  });

  it('does not resume an old monitor after its amount scope changes', () => {
    const { rerender } = render(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />,
    );

    mockSwapState.quoteEventCompleted = false;
    mockSwapState.quoteEventError = undefined;
    mockSwapState.fromAmount = {
      isInput: true,
      value: '3',
    };
    rerender(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);
    expect(mockUseSwapStockTokenDetail.mock.calls.at(-1)?.[0]).toMatchObject({
      enabled: false,
      token: mockStockToken,
    });

    mockSwapState.fromAmount = {
      isInput: true,
      value: '2',
    };
    rerender(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);
    expect(mockUseSwapStockTokenDetail.mock.calls.at(-1)?.[0]).toMatchObject({
      enabled: false,
      token: mockStockToken,
    });
  });

  it('keeps an enriched closed alert through a transient detail failure', () => {
    const { rerender } = render(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />,
    );

    expect(mockResolveStockMarketStatusCase).toHaveBeenLastCalledWith({
      hasOpenTime: true,
      hasPerps: true,
      isOpen: false,
    });

    mockStockDetailResult = {
      ...mockStockDetailResult,
      latestFetchSucceeded: false,
    };
    rerender(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockResolveStockMarketStatusCase).toHaveBeenLastCalledWith({
      hasOpenTime: true,
      hasPerps: true,
      isOpen: false,
    });
    const alertProps = mockStockMarketStatusAlert.mock.calls.at(-1)?.[0];
    expect(alertProps?.timeText).toBe('Reopens in 2h');
    expect(alertProps?.onTradePerps).toEqual(expect.any(Function));
  });

  it('keeps a halted alert through a transient detail failure', () => {
    mockStockDetailResult = {
      fetchedAt: 1,
      latestFetchSucceeded: true,
      pending: false,
      tokenDetail: {
        stock: {
          isOpen: true,
          isPaused: true,
        },
      },
    };
    const { rerender } = render(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />,
    );
    expect(mockAlert).toHaveBeenCalledTimes(1);

    mockStockDetailResult = {
      ...mockStockDetailResult,
      latestFetchSucceeded: false,
    };
    rerender(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockAlert).toHaveBeenCalledTimes(2);
    expect(mockStockMarketStatusAlert).not.toHaveBeenCalled();
  });

  it('does not fetch Market detail for a stale amount or unsupported tab', () => {
    mockSwapState.fromAmount = {
      isInput: true,
      value: '3',
    };
    const { rerender } = render(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />,
    );

    expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(1, {
      enabled: false,
      requireCurrentActivation: true,
      token: mockUsdcToken,
    });
    expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(2, {
      enabled: false,
      requireCurrentActivation: true,
      token: mockStockToken,
    });
    expect(mockStockMarketStatusAlert).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockSwapState.fromAmount = {
      isInput: true,
      value: '2',
    };
    mockSwapState.swapType = ESwapTabSwitchType.LIMIT;
    rerender(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(1, {
      enabled: false,
      requireCurrentActivation: true,
      token: mockUsdcToken,
    });
    expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(2, {
      enabled: false,
      requireCurrentActivation: true,
      token: mockStockToken,
    });
    expect(mockStockMarketStatusAlert).not.toHaveBeenCalled();
  });

  it('refreshes once when the first Market detail says the market reopened', () => {
    const onMarketReopen = jest.fn();
    mockStockDetailResult = {
      fetchedAt: 1,
      latestFetchSucceeded: true,
      pending: false,
      tokenDetail: {
        stock: {
          isOpen: true,
        },
      },
    };
    const { rerender } = render(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={onMarketReopen} />,
    );

    expect(onMarketReopen).toHaveBeenCalledTimes(1);
    expect(mockStockMarketStatusAlert).not.toHaveBeenCalled();

    rerender(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={onMarketReopen} />,
    );
    expect(onMarketReopen).toHaveBeenCalledTimes(1);
    expect(mockStockMarketStatusAlert).not.toHaveBeenCalled();
  });

  it('shows a halted alert without the closed-market Perps prompt', () => {
    mockStockDetailResult = {
      fetchedAt: 1,
      latestFetchSucceeded: true,
      pending: false,
      tokenDetail: {
        stock: {
          isOpen: true,
          isPaused: true,
        },
      },
    };

    render(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockStockMarketStatusAlert).not.toHaveBeenCalled();
  });
});
