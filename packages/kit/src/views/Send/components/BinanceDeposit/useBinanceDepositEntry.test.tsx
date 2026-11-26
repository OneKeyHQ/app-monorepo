/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IBinanceDepositAsset } from '@onekeyhq/shared/types/binanceDeposit';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useBinanceDepositEntry } from './useBinanceDepositEntry';

const mockGetDepositAsset = jest.fn<
  Promise<IBinanceDepositAsset | undefined>,
  unknown[]
>();
const mockCanOpenExchangeApp = jest.fn<Promise<boolean>, unknown[]>();
const mockEntryShowEvent = jest.fn<void, unknown[]>();
const mockEnv = { allowList: false, travelMode: false };
const initialIsNative = platformEnv.isNative;

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceBinanceDeposit: {
      getDepositAsset: (...args: unknown[]) => mockGetDepositAsset(...args),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useExchangeAppDetection', () => ({
  canOpenExchangeApp: (...args: unknown[]) => mockCanOpenExchangeApp(...args),
}));

jest.mock('@onekeyhq/kit/src/components/AddressInput/hooks', () => ({
  useIsEnableTransferAllowList: () => mockEnv.allowList,
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({
      profile: { kind: mockEnv.travelMode ? 'travel-mode' : 'default' },
    }),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    transaction: {
      send: {
        binanceDepositEntryShow: (...args: unknown[]) =>
          mockEntryShowEvent(...args),
      },
    },
  },
}));

// Runs the method on mount and whenever the deps change, like the real hook
// without its cache.
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (method: () => Promise<unknown>, deps: unknown[]) => {
      const [result, setResult] = React.useState<unknown>();
      const methodRef = React.useRef(method);
      methodRef.current = method;
      const run = React.useCallback(async () => {
        setResult(await methodRef.current());
      }, []);
      const depsKey = JSON.stringify(deps);
      React.useEffect(() => {
        void run();
      }, [run, depsKey]);
      return { result, setResult, run };
    },
  };
});

const NETWORK_ID = 'evm--56';
const HD_ACCOUNT_ID = "hd-1--m/44'/60'/0'/0/0";
const USDT = {
  symbol: 'USDT',
  address: '0x55d398326f99059ff775485246999027b3197955',
  isNative: false,
} as IToken;
const ASSET: IBinanceDepositAsset = {
  networkId: NETWORK_ID,
  cryptoCurrency: 'USDT',
  contractAddress: USDT.address,
  requiresAddressTag: false,
};

function mountEntry(
  patch: Partial<Parameters<typeof useBinanceDepositEntry>[0]> = {},
) {
  return renderHook(() =>
    useBinanceDepositEntry({
      accountId: HD_ACCOUNT_ID,
      networkId: NETWORK_ID,
      token: USDT,
      isNFT: false,
      ...patch,
    }),
  );
}

beforeEach(() => {
  (platformEnv as { isNative: boolean }).isNative = true;
  Object.assign(mockEnv, { allowList: false, travelMode: false });
  mockGetDepositAsset.mockReset();
  mockGetDepositAsset.mockResolvedValue(ASSET);
  mockCanOpenExchangeApp.mockReset();
  mockCanOpenExchangeApp.mockResolvedValue(true);
  mockEntryShowEvent.mockReset();
});

afterAll(() => {
  (platformEnv as { isNative: boolean }).isNative = !!initialIsNative;
});

describe('useBinanceDepositEntry', () => {
  it('offers the entry when Binance lists the token and its app is installed', async () => {
    const { result } = mountEntry();

    await waitFor(() => expect(result.current.isEntryAvailable).toBe(true));
    expect(mockGetDepositAsset).toHaveBeenCalledWith({
      networkId: NETWORK_ID,
      symbol: 'USDT',
      contractAddress: USDT.address,
      isNative: false,
    });
    expect(result.current.asset).toEqual(ASSET);
  });

  it('keeps the entry hidden while the Binance app is missing', async () => {
    mockCanOpenExchangeApp.mockResolvedValue(false);
    const { result } = mountEntry();

    await waitFor(() => expect(mockCanOpenExchangeApp).toHaveBeenCalled());
    expect(result.current.isEntryAvailable).toBe(false);
  });

  it('keeps the entry hidden for a token Binance does not take', async () => {
    mockGetDepositAsset.mockResolvedValue(undefined);
    const { result } = mountEntry();

    await waitFor(() => expect(mockGetDepositAsset).toHaveBeenCalled());
    expect(result.current.isEntryAvailable).toBe(false);
    expect(mockCanOpenExchangeApp).not.toHaveBeenCalled();
  });

  it.each([
    [
      'off the phone apps',
      () => {
        (platformEnv as { isNative: boolean }).isNative = false;
      },
    ],
    [
      'with the transfer allowlist on',
      () => Object.assign(mockEnv, { allowList: true }),
    ],
    ['in Travel Mode', () => Object.assign(mockEnv, { travelMode: true })],
  ])('never asks for the asset %s', async (_label, arrange) => {
    arrange();
    const { result } = mountEntry();

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockGetDepositAsset).not.toHaveBeenCalled();
    expect(result.current.isEntryAvailable).toBe(false);
  });

  it.each([
    ['an NFT', { isNFT: true }],
    ['a watch-only account', { accountId: 'watching--evm--0x1' }],
  ])('never asks for the asset for %s', async (_label, patch) => {
    const { result } = mountEntry(patch);

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockGetDepositAsset).not.toHaveBeenCalled();
    expect(result.current.isEntryAvailable).toBe(false);
  });

  it('reports the entry once per asset, however often it shows', async () => {
    const { result } = mountEntry();
    await waitFor(() => expect(result.current.isEntryAvailable).toBe(true));

    act(() => {
      result.current.reportEntryShown();
      result.current.reportEntryShown();
    });

    expect(mockEntryShowEvent).toHaveBeenCalledTimes(1);
    expect(mockEntryShowEvent).toHaveBeenCalledWith({
      network: NETWORK_ID,
      tokenSymbol: 'USDT',
    });
  });

  it('takes the entry away once Binance turns the asset off', async () => {
    const { result } = mountEntry();
    await waitFor(() => expect(result.current.isEntryAvailable).toBe(true));

    act(() => {
      result.current.hideAsset();
    });

    expect(result.current.isEntryAvailable).toBe(false);
  });
});
