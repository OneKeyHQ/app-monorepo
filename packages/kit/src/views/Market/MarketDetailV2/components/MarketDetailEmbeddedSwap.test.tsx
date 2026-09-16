/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { EPageType } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { MarketEmbeddedSwap } from '../layouts/MarketEmbeddedSwap';

import { MarketDetailEmbeddedSwap } from './MarketDetailEmbeddedSwap';

const mockEmbeddedSwap = jest.fn((_props: Record<string, unknown>) => null);
const mockEmbeddedSwapMounted = jest.fn();
let mockConfigReady = true;
const mockPaymentToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

let mockDefaultTokens = [mockPaymentToken];

jest.mock('@onekeyhq/components', () => {
  return {
    EPageType: { modal: 'modal' },
    Skeleton: () => null,
    Spinner: () => null,
    Stack: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => <div data-testid={testID}>{children}</div>,
    XStack: ({ children }: { children?: React.ReactNode }) => (
      <div>{children}</div>
    ),
    YStack: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => <div data-testid={testID}>{children}</div>,
  };
});

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({
    children,
  }: {
    children?: React.ReactNode;
  }) => <>{children}</>,
}));

jest.mock('../layouts/components/MarketStockTradeTarget', () => ({
  MarketStockTradeTarget: () => null,
}));

jest.mock('@onekeyhq/shared/src/lazyLoad', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: jest.fn(() => {
      function MockEmbeddedSwap(props: Record<string, unknown>) {
        React.useEffect(() => {
          mockEmbeddedSwapMounted();
        }, []);
        return mockEmbeddedSwap(props);
      }
      return MockEmbeddedSwap;
    }),
  };
});

jest.mock('@onekeyhq/shared/src/utils/tokenUtils', () => ({
  equalTokenNoCaseSensitive: jest.fn(
    ({
      token1,
      token2,
    }: {
      token1: { contractAddress?: string; networkId?: string };
      token2: { contractAddress?: string; networkId?: string };
    }) =>
      token1.networkId === token2.networkId &&
      token1.contractAddress === token2.contractAddress,
  ),
}));

jest.mock('@onekeyhq/shared/types', () => {
  const actual = jest.requireActual<typeof import('@onekeyhq/shared/types')>(
    '@onekeyhq/shared/types',
  );
  return {
    ...actual,
    EAccountSelectorSceneName: {
      ...actual.EAccountSelectorSceneName,
      swap: 'swap',
    },
  };
});

jest.mock('@onekeyhq/shared/types/swap/types', () => ({
  ESwapSlippageSegmentKey: { AUTO: 'Auto', CUSTOM: 'Custom' },
  ESwapSource: { MARKET: 'market' },
  ESwapTabSwitchType: { SWAP: 'swap', STOCK: 'stock' },
}));

jest.mock('./SwapPanel/hooks/useSpeedSwapInit', () => ({
  useSpeedSwapInit: jest.fn(() => ({
    defaultTokens: mockDefaultTokens,
    speedConfigReady: mockConfigReady,
  })),
}));

const marketToken = {
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  symbol: 'TOKEN',
  decimals: 18,
};

describe('MarketDetailEmbeddedSwap', () => {
  beforeEach(() => {
    mockConfigReady = true;
    mockDefaultTokens = [mockPaymentToken];
    mockEmbeddedSwap.mockClear();
    mockEmbeddedSwapMounted.mockClear();
  });

  it('initializes stock targets with the stock protocol', () => {
    render(
      <MarketDetailEmbeddedSwap
        swapToken={{ ...marketToken, isStock: true }}
        testID="stock"
      />,
    );
    expect(mockEmbeddedSwap).toHaveBeenLastCalledWith(
      expect.objectContaining({
        storeName: EJotaiContextStoreNames.marketSwap,
        swapInitParams: expect.objectContaining({
          swapTabSwitchType: ESwapTabSwitchType.STOCK,
        }),
      }),
    );
  });

  it('waits for configuration and refreshes the payment seed without remounting', () => {
    mockConfigReady = false;
    mockDefaultTokens = [];
    const view = render(
      <MarketDetailEmbeddedSwap swapToken={marketToken} testID="swap" />,
    );
    expect(mockEmbeddedSwap).not.toHaveBeenCalled();
    mockConfigReady = true;
    mockDefaultTokens = [mockPaymentToken];
    view.rerender(
      <MarketDetailEmbeddedSwap swapToken={marketToken} testID="swap" />,
    );
    const updatedPaymentToken = {
      ...mockPaymentToken,
      symbol: 'OTHER',
      contractAddress: '0xother',
    };
    mockDefaultTokens = [updatedPaymentToken];
    view.rerender(
      <MarketDetailEmbeddedSwap swapToken={marketToken} testID="swap" />,
    );
    expect(mockEmbeddedSwap.mock.lastCall?.[0].swapInitParams).toEqual(
      expect.objectContaining({
        importFromToken: updatedPaymentToken,
      }),
    );
    expect(mockEmbeddedSwapMounted).toHaveBeenCalledTimes(1);
  });

  it('opens the current Market token in the shared Swap UI', () => {
    const view = render(
      <MarketDetailEmbeddedSwap
        swapToken={marketToken}
        testID="market-token-detail-trade-ready"
      />,
    );

    expect(view.getByTestId('market-token-detail-trade-ready')).toBeTruthy();
    expect(mockEmbeddedSwap).toHaveBeenLastCalledWith(
      expect.objectContaining({
        storeName: EJotaiContextStoreNames.marketSwap,
        pageType: EPageType.modal,
        singleSwapBridgeHeader: true,
        swapInitParams: {
          importFromToken: mockPaymentToken,
          importNetworkId: mockPaymentToken.networkId,
          importToToken: marketToken,
          swapSource: ESwapSource.MARKET,
          swapTabSwitchType: ESwapTabSwitchType.SWAP,
        },
      }),
    );
  });

  it('updates the Market detail token without remounting Swap', () => {
    const view = render(
      <MarketDetailEmbeddedSwap
        swapToken={marketToken}
        testID="market-token-detail-trade-ready"
      />,
    );

    view.rerender(
      <MarketDetailEmbeddedSwap
        swapToken={{ ...marketToken, contractAddress: '0xnext' }}
        testID="market-token-detail-trade-ready"
      />,
    );

    expect(mockEmbeddedSwapMounted).toHaveBeenCalledTimes(1);
    expect(mockEmbeddedSwap.mock.lastCall?.[0].swapInitParams).toEqual(
      expect.objectContaining({
        importToToken: expect.objectContaining({ contractAddress: '0xnext' }),
      }),
    );
  });

  it('updates an explicit Market asset identity without remounting Swap', () => {
    const view = render(
      <MarketDetailEmbeddedSwap
        resetKey="asset-1"
        swapToken={marketToken}
        testID="market-top-coins-trade-ready"
      />,
    );

    view.rerender(
      <MarketDetailEmbeddedSwap
        resetKey="asset-2"
        swapToken={marketToken}
        testID="market-top-coins-trade-ready"
      />,
    );

    expect(mockEmbeddedSwapMounted).toHaveBeenCalledTimes(1);
  });

  it('shows a loading shell before the first stock trade content mounts', () => {
    const view = render(
      <MarketEmbeddedSwap
        swapToken={{ ...marketToken, isStock: true }}
        inputDraftKey="stock:MSFT"
        isTradeLoading
      />,
    );

    expect(view.getByTestId('market-embedded-swap-trade-loading')).toBeTruthy();
    expect(mockEmbeddedSwap).not.toHaveBeenCalled();

    view.rerender(
      <MarketEmbeddedSwap
        swapToken={{ ...marketToken, isStock: true }}
        inputDraftKey="stock:MSFT"
      />,
    );

    expect(view.queryByTestId('market-embedded-swap-trade-loading')).toBeNull();
    expect(view.getByTestId('market-embedded-swap-trade-ready')).toBeTruthy();
    expect(mockEmbeddedSwap).toHaveBeenCalledTimes(1);
  });

  it('keeps mounted stock trade content during a later loading transition', () => {
    const view = render(
      <MarketEmbeddedSwap
        swapToken={{ ...marketToken, isStock: true }}
        inputDraftKey="stock:MSFT"
      />,
    );
    expect(mockEmbeddedSwap).toHaveBeenCalledTimes(1);

    view.rerender(
      <MarketEmbeddedSwap
        swapToken={{ ...marketToken, isStock: true }}
        inputDraftKey="stock:MSFT"
        isTradeLoading
      />,
    );

    expect(view.queryByTestId('market-embedded-swap-trade-loading')).toBeNull();
    expect(view.getByTestId('market-embedded-swap-trade-ready')).toBeTruthy();
    expect(mockEmbeddedSwapMounted).toHaveBeenCalledTimes(1);
    expect(mockEmbeddedSwap.mock.lastCall?.[0].stockTradeIdentityLoading).toBe(
      true,
    );
  });

  it('keeps mounted stock trade content while switching listings', () => {
    const view = render(
      <MarketEmbeddedSwap
        swapToken={{ ...marketToken, isStock: true }}
        inputDraftKey="stock:MSFT"
        stockTradeToken={{ ...marketToken, isStock: true }}
      />,
    );

    view.rerender(
      <MarketEmbeddedSwap
        swapToken={{
          ...marketToken,
          contractAddress: '0xgoog',
          decimals: 0,
          isStock: true,
        }}
        inputDraftKey="stock:GOOG"
        isTradeLoading
        stockTradeToken={{
          ...marketToken,
          contractAddress: '0xgoog',
          decimals: 0,
          isStock: true,
        }}
      />,
    );

    expect(view.queryByTestId('market-embedded-swap-trade-loading')).toBeNull();
    expect(view.getByTestId('market-embedded-swap-trade-ready')).toBeTruthy();
    expect(mockEmbeddedSwapMounted).toHaveBeenCalledTimes(1);

    view.rerender(
      <MarketEmbeddedSwap
        swapToken={{
          ...marketToken,
          contractAddress: '0xgoog',
          isStock: true,
        }}
        inputDraftKey="stock:GOOG"
        stockTradeToken={{
          ...marketToken,
          contractAddress: '0xgoog',
          isStock: true,
        }}
      />,
    );

    expect(mockEmbeddedSwapMounted).toHaveBeenCalledTimes(1);
    expect(mockEmbeddedSwap.mock.lastCall?.[0].stockTradeToken).toEqual(
      expect.objectContaining({ contractAddress: '0xgoog' }),
    );
    expect(mockEmbeddedSwap.mock.lastCall?.[0].stockTradeIdentityLoading).toBe(
      false,
    );
  });

  it('does not seed a mounted stock Swap with unresolved variant metadata', () => {
    const view = render(
      <MarketEmbeddedSwap
        swapToken={{ ...marketToken, isStock: true }}
        inputDraftKey="stock:MSFT"
        stockTradeToken={{ ...marketToken, isStock: true }}
      />,
    );
    expect(mockEmbeddedSwap.mock.lastCall?.[0].swapInitParams).toEqual(
      expect.objectContaining({
        importToToken: expect.objectContaining({
          contractAddress: '0xtoken',
          decimals: 18,
        }),
      }),
    );
    expect(mockEmbeddedSwap.mock.lastCall?.[0].stockTradeToken).toEqual(
      expect.objectContaining({ contractAddress: '0xtoken', decimals: 18 }),
    );

    view.rerender(
      <MarketEmbeddedSwap
        swapToken={{
          ...marketToken,
          contractAddress: '0xnext',
          decimals: 0,
          isStock: true,
        }}
        inputDraftKey="stock:MSFT"
        isTradeLoading
        stockTradeToken={{
          ...marketToken,
          contractAddress: '0xnext',
          decimals: 0,
          isStock: true,
        }}
      />,
    );

    expect(mockEmbeddedSwap.mock.lastCall?.[0].swapInitParams).toEqual(
      expect.objectContaining({
        importToToken: expect.objectContaining({
          contractAddress: '0xtoken',
          decimals: 18,
        }),
      }),
    );
    expect(mockEmbeddedSwap.mock.lastCall?.[0].stockTradeToken).toEqual(
      expect.objectContaining({ contractAddress: '0xtoken', decimals: 18 }),
    );

    view.rerender(
      <MarketEmbeddedSwap
        swapToken={{ ...marketToken, contractAddress: '0xnext', isStock: true }}
        inputDraftKey="stock:MSFT"
        stockTradeToken={{
          ...marketToken,
          contractAddress: '0xnext',
          isStock: true,
        }}
      />,
    );

    expect(mockEmbeddedSwap.mock.lastCall?.[0].swapInitParams).toEqual(
      expect.objectContaining({
        importToToken: expect.objectContaining({
          contractAddress: '0xnext',
          decimals: 18,
        }),
      }),
    );
    expect(mockEmbeddedSwap.mock.lastCall?.[0].stockTradeToken).toEqual(
      expect.objectContaining({ contractAddress: '0xnext', decimals: 18 }),
    );
  });
});
