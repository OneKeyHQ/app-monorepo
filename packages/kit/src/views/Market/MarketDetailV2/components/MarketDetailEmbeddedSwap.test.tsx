/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { EPageType } from '@onekeyhq/components';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { MarketDetailEmbeddedSwap } from './MarketDetailEmbeddedSwap';

const mockEmbeddedSwap = jest.fn((_props: Record<string, unknown>) => null);
const mockEmbeddedSwapMounted = jest.fn();
const mockPaymentToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

jest.mock('@onekeyhq/components', () => {
  return {
    EPageType: { modal: 'modal' },
    Spinner: () => null,
    Stack: ({
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

jest.mock('@onekeyhq/shared/types', () => ({
  EAccountSelectorSceneName: { swap: 'swap' },
}));

jest.mock('@onekeyhq/shared/types/swap/types', () => ({
  ESwapSource: { MARKET: 'market' },
  ESwapTabSwitchType: { SWAP: 'swap' },
}));

jest.mock('./SwapPanel/hooks/useSpeedSwapInit', () => ({
  useSpeedSwapInit: jest.fn(() => ({
    defaultTokens: [mockPaymentToken],
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
    mockEmbeddedSwap.mockClear();
    mockEmbeddedSwapMounted.mockClear();
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

  it('remounts Swap when the Market detail token changes', () => {
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

    expect(mockEmbeddedSwapMounted).toHaveBeenCalledTimes(2);
  });

  it('uses an explicit Market asset identity to reset Swap', () => {
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

    expect(mockEmbeddedSwapMounted).toHaveBeenCalledTimes(2);
  });
});
