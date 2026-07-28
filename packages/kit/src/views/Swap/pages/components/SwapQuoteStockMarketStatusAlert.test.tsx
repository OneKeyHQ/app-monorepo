/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { SwapQuoteStockMarketStatusAlert } from './SwapQuoteStockMarketStatusAlert';

const mockNavigateToPerps = jest.fn();
type IMockStockMarketStatusAlertProps = {
  onTradePerps?: () => void;
  statusCase: unknown;
  timeText?: string;
};
type IMockStockTokenDetailParams = {
  enabled: boolean;
  token?: ISwapToken;
};
type IMockStockTokenDetailResult = {
  displayTokenDetail?: unknown;
  pending: boolean;
  perpsInfo?: { hlTicker: string };
  tokenDetail?: {
    stock?: {
      description?: string;
      isOpen?: boolean;
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
const mockSwapState = {
  fromAmount: {
    isInput: true,
    value: '2',
  },
  fromToken: mockUsdcToken as ISwapToken | undefined,
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

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapFromTokenAmountAtom: () => [mockSwapState.fromAmount],
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
    mockSwapState.quoteEventError = {
      fromToken: mockUsdcToken,
      fromTokenAmount: '2',
      isMarketOpen: false,
      isStock: true,
      message: 'Market closed',
      toToken: mockStockToken,
    };
    mockStockDetailResult = {
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
        token: mockUsdcToken,
      });
      expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(2, {
        enabled: true,
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
      ...mockSwapState.quoteEventError,
      toToken: mockSwapState.toToken,
    };

    render(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(1, {
      enabled: true,
      token: mockUsdcToken,
    });
    expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(2, {
      enabled: true,
      token: mockSwapState.toToken,
    });
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
      token: mockUsdcToken,
    });
    expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(2, {
      enabled: false,
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
      token: mockUsdcToken,
    });
    expect(mockUseSwapStockTokenDetail).toHaveBeenNthCalledWith(2, {
      enabled: false,
      token: mockStockToken,
    });
    expect(mockStockMarketStatusAlert).not.toHaveBeenCalled();
  });

  it('waits for Market detail to confirm closure before rendering the alert', () => {
    mockStockDetailResult = {
      pending: true,
    };
    const { rerender } = render(
      <SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />,
    );

    expect(mockStockMarketStatusAlert).not.toHaveBeenCalled();

    mockStockDetailResult = {
      pending: false,
      tokenDetail: {
        stock: {
          description: 'Reopens in 2h\nProvider description',
          isOpen: false,
        },
      },
    };
    rerender(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockStockMarketStatusAlert).toHaveBeenCalledTimes(1);
    expect(mockStockMarketStatusAlert.mock.calls[0]?.[0].timeText).toBe(
      'Reopens in 2h',
    );
  });

  it('falls back to a generic closed alert after Market detail settles empty', () => {
    mockStockDetailResult = {
      pending: false,
    };

    render(<SwapQuoteStockMarketStatusAlert onMarketReopen={jest.fn()} />);

    expect(mockResolveStockMarketStatusCase).toHaveBeenCalledWith({
      hasOpenTime: false,
      hasPerps: false,
      isOpen: false,
    });
    expect(mockStockMarketStatusAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        onTradePerps: undefined,
        timeText: undefined,
      }),
    );
  });

  it('refreshes once when the first Market detail says the market reopened', () => {
    const onMarketReopen = jest.fn();
    mockStockDetailResult = {
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
});
