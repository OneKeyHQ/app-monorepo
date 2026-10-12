/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { act, renderHook } from '@testing-library/react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IMarketStockPublicItem,
  IMarketStockTokenVariant,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  SwapStockMarketProvider,
  useSwapStockSelection,
} from './SwapStockMarketProvider';

const mockCommit = jest.fn();
const mockPushModal = jest.fn();
const mockCheckRisk = jest.fn<Promise<boolean>, [ISwapToken]>();
const mockLookup = jest.fn<Promise<ISwapToken>, []>();
const token: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xabc',
  name: 'Apple',
  symbol: 'AAPLx',
  decimals: 18,
  logoURI: '',
  isNative: false,
  stock: { stockId: 'AAPL', subtitle: 'Apple', sourceLogoUri: '' },
};
const stock: IMarketStockPublicItem = {
  stockId: 'AAPL',
  symbol: 'AAPL',
  name: 'Apple',
  logoUrl: '',
  assetType: 'stock',
  price: '200',
  priceChange24hPercent: '1',
  currency: 'USD',
};
const variant: IMarketStockTokenVariant = {
  tokenId: 'aapl-x',
  networkId: token.networkId,
  contractAddress: token.contractAddress,
  symbol: token.symbol,
  name: token.name,
  logoUrl: '',
  issuer: 'xstocks',
  currency: 'USD',
  status: 'active',
  tradingEnabled: true,
};

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: undefined, run: jest.fn() }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/StockDetailContext',
  () => ({
    StockDetailProvider: ({ children }: PropsWithChildren) => children,
    useStockDetail: () => ({
      stockId: 'AAPL',
      tokenVariants: [],
      isTokenVariantPending: false,
      isTokenVariantsError: false,
    }),
  }),
);
jest.mock('./SwapStockTradeProvider', () => ({
  useSwapStockTradeContext: () => ({
    currentStockToken: token,
    selectStockSwapToken: mockCommit,
  }),
}));
jest.mock('../../hooks/useSwapStockChannel', () => ({
  ESwapStockChannelAsyncStatus: jest.requireActual<
    typeof import('../../hooks/swapStockChannelUtils')
  >('../../hooks/swapStockChannelUtils').ESwapStockChannelAsyncStatus,
}));
jest.mock('../../hooks/useSwapTokenRiskCheck', () => ({
  useSwapTokenRiskCheck: () => mockCheckRisk,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../utils/swapStockMarketData', () => ({
  ...jest.requireActual<typeof import('../../utils/swapStockMarketData')>(
    '../../utils/swapStockMarketData',
  ),
  fetchSwapStockSelection: () => mockLookup(),
  fetchSwapStockVariantToken: () => mockLookup(),
}));

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
function Wrapper({ children }: PropsWithChildren) {
  return (
    <SwapStockMarketProvider storeName={EJotaiContextStoreNames.swap}>
      {children}
    </SwapStockMarketProvider>
  );
}
function renderSelection() {
  return renderHook(
    () => {
      const selection = useSwapStockSelection();
      if (!selection) throw new OneKeyLocalError('Missing selection provider');
      return selection;
    },
    { wrapper: Wrapper },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLookup.mockReset().mockResolvedValue(token);
  mockCheckRisk.mockReset().mockResolvedValue(false);
});

it.each(['ticker', 'variant'] as const)(
  'cancels a dismissed %s selector during token lookup',
  async (kind) => {
    const lookup = deferred<ISwapToken>();
    mockLookup.mockReturnValueOnce(lookup.promise);
    const { result } = renderSelection();
    let request: Promise<boolean> | undefined;
    act(() => {
      request =
        kind === 'ticker'
          ? result.current.selectStock(stock)
          : result.current.selectVariant(variant);
    });
    expect(result.current.selecting).toBe(true);
    act(() => result.current.onSelectorOpenChange(false));
    await act(async () => {
      lookup.resolve(token);
      expect(await request).toBe(false);
    });
    expect(mockCheckRisk).not.toHaveBeenCalled();
    expect(mockCommit).not.toHaveBeenCalled();
    expect(result.current.selecting).toBe(false);
  },
);

it.each(['ticker', 'variant'] as const)(
  'cancels a dismissed %s selector during risk checking',
  async (kind) => {
    const risk = deferred<boolean>();
    mockCheckRisk.mockReturnValueOnce(risk.promise);
    const { result } = renderSelection();
    let request: Promise<boolean> | undefined;
    await act(async () => {
      request =
        kind === 'ticker'
          ? result.current.selectStock(stock)
          : result.current.selectVariant(variant);
    });
    expect(mockCheckRisk).toHaveBeenCalled();
    act(() => result.current.onSelectorOpenChange(false));
    await act(async () => {
      risk.resolve(true);
      expect(await request).toBe(false);
    });
    expect(mockCommit).not.toHaveBeenCalled();
    expect(mockPushModal).not.toHaveBeenCalled();
  },
);

it('preserves a completed selection when its selector closes', async () => {
  mockLookup.mockResolvedValueOnce({ ...token, contractAddress: '0xdef' });
  const { result } = renderSelection();
  await act(async () => {
    expect(await result.current.selectStock(stock)).toBe(true);
  });
  act(() => result.current.onSelectorOpenChange(false));
  expect(mockCommit).toHaveBeenCalledTimes(1);
  expect(result.current.loadingScopes.tradeTarget).toBe(true);
});

it('preserves risk confirmation after its intentional selector close, but invalidates it on a new open', async () => {
  mockCheckRisk.mockResolvedValue(true);
  const { result } = renderSelection();
  await act(async () => {
    expect(await result.current.selectStock(stock)).toBe(true);
  });
  const modal = mockPushModal.mock.calls[0][1] as {
    params: { onConfirm: (close: () => void) => void };
  };
  act(() => result.current.onSelectorOpenChange(false));
  act(() => modal.params.onConfirm(jest.fn()));
  expect(mockCommit).toHaveBeenCalledTimes(1);
  await act(async () => {
    await result.current.selectVariant(variant);
  });
  const nextModal = mockPushModal.mock.calls[1][1] as typeof modal;
  act(() => result.current.onSelectorOpenChange(false));
  act(() => result.current.onSelectorOpenChange(true));
  act(() => nextModal.params.onConfirm(jest.fn()));
  expect(mockCommit).toHaveBeenCalledTimes(1);
});
