/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const SOLANA_ADDRESS = 'So11111111111111111111111111111111111111112';
const EVM_ADDRESS = '0x1111111111111111111111111111111111111111';
const mockGetNetworkAccount = jest.fn<
  Promise<{ id: string; addressDetail: { address: string } }>,
  [{ networkId: string; indexedAccountId?: string }]
>();
const mockFetchQuote = jest.fn(async (_params: unknown) => ({
  result: { toAmount: '60' },
}));
const mockCancelQuote = jest.fn(async () => undefined);
const mockSetOrders = jest.fn();
const mockIntl = { formatMessage: jest.fn(() => '') };

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/components', () => {
  const { useMemo } = jest.requireActual<typeof import('react')>('react');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useNetInfo: () => ({ isRawInternetReachable: true }),
    useDeferredPromise: () =>
      useMemo(
        () => ({
          promise: Promise.resolve(),
          resolve: () => undefined,
          reset: () => undefined,
        }),
        [],
      ),
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {},
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{}],
  usePerpsDepositOrderAtom: () => [{ orders: [] }, mockSetOrders],
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getGlobalDeriveTypeOfNetwork: async () => 'default',
    },
    serviceAccount: {
      getNetworkAccount: (
        params: Parameters<typeof mockGetNetworkAccount>[0],
      ) => mockGetNetworkAccount(params),
    },
    serviceSwap: {
      fetchPerpDepositQuote: (params: unknown) => mockFetchQuote(params),
      cancelFetchPerpDepositQuote: () => mockCancelQuote(),
    },
  },
}));

import {
  usePerpsAmountInput,
  usePerpsDepositQuoteAmount,
} from '../components/TradingPanel/modals/usePerpsAmountInput';

import usePerpDeposit from './usePerpDeposit';

const solanaUsdc: IPerpsDepositToken = {
  networkId: 'sol--101',
  contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  networkLogoURI: '',
};
const eth: IPerpsDepositToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
  networkLogoURI: '',
};
type IProps = { token: IPerpsDepositToken; amount: string; account: string };

function networkAccount(networkId: string) {
  return {
    id: networkId,
    addressDetail: {
      address: networkId === 'sol--101' ? SOLANA_ADDRESS : EVM_ADDRESS,
    },
  };
}

describe('Perps deposit quote identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNetworkAccount.mockImplementation(async ({ networkId }) =>
      networkAccount(networkId),
    );
  });

  it('waits for a new account even when the deposit network is unchanged', async () => {
    const { rerender } = renderHook(
      ({ token, amount, account }: IProps) =>
        usePerpDeposit(amount, 'deposit', account, undefined, token, true),
      { initialProps: { token: eth, amount: '0.01', account: 'hd-1' } },
    );
    await waitFor(() => expect(mockFetchQuote).toHaveBeenCalledTimes(1));
    mockFetchQuote.mockClear();

    const nextAccount = {
      id: 'eth-account-2',
      addressDetail: { address: '0x2222222222222222222222222222222222222222' },
    };
    let resolveAccount: (account: typeof nextAccount) => void = () => undefined;
    const pendingAccount = new Promise<typeof nextAccount>((resolve) => {
      resolveAccount = resolve;
    });
    mockGetNetworkAccount.mockImplementation(async () => pendingAccount);
    rerender({ token: eth, amount: '0.01', account: 'hd-2' });
    await act(async () => Promise.resolve());
    expect(mockFetchQuote).not.toHaveBeenCalled();

    await act(async () => resolveAccount(nextAccount));
    await waitFor(() => expect(mockFetchQuote).toHaveBeenCalledTimes(1));
    expect(mockFetchQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userAddress: nextAccount.addressDetail.address,
        receivingAddress: nextAccount.addressDetail.address,
      }),
    );
  });

  it('waits for the ETH payer instead of quoting with the old Solana address', async () => {
    const { rerender } = renderHook(
      ({ token, amount, account }: IProps) =>
        usePerpDeposit(amount, 'deposit', account, undefined, token, true),
      {
        initialProps: {
          token: solanaUsdc,
          amount: '62.161578',
          account: 'hd-1',
        },
      },
    );
    await waitFor(() => expect(mockFetchQuote).toHaveBeenCalledTimes(1));
    expect(mockFetchQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({ userAddress: SOLANA_ADDRESS }),
    );
    mockFetchQuote.mockClear();

    let resolveEthAccount: (
      account: ReturnType<typeof networkAccount>,
    ) => void = () => undefined;
    const ethAccount = new Promise<ReturnType<typeof networkAccount>>(
      (resolve) => {
        resolveEthAccount = resolve;
      },
    );
    mockGetNetworkAccount.mockImplementation(async ({ networkId }) =>
      networkId === 'evm--1' ? ethAccount : networkAccount(networkId),
    );
    rerender({ token: eth, amount: '0.01', account: 'hd-1' });
    await act(async () => Promise.resolve());
    expect(mockFetchQuote).not.toHaveBeenCalled();

    await act(async () => resolveEthAccount(networkAccount('evm--1')));
    await waitFor(() => expect(mockFetchQuote).toHaveBeenCalledTimes(1));
    expect(mockFetchQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fromNetworkId: 'evm--1',
        fromTokenAmount: '0.01',
        userAddress: EVM_ADDRESS,
        receivingAddress: EVM_ADDRESS,
      }),
    );
  });
});

function useDepositForm(token: IPerpsDepositToken) {
  const tokenIdentity = `${token.networkId}::${token.contractAddress}`;
  const input = usePerpsAmountInput({
    unit: 'token',
    tokenPrice: token.networkId === 'sol--101' ? '1' : '2000',
    tokenDecimals: token.decimals,
    resetKey: tokenIdentity,
  });
  const tokenAmount = input.tokenAmountBN.gt(0)
    ? input.tokenAmountBN.toFixed()
    : '';
  const quoteAmount = usePerpsDepositQuoteAmount(tokenAmount, tokenIdentity);
  const quote = usePerpDeposit(
    quoteAmount,
    'deposit',
    'hd-1',
    undefined,
    token,
    Boolean(input.amount),
  );
  return { ...input, ...quote };
}

describe('Solana USDC to ETH deposit form regression', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetNetworkAccount.mockImplementation(async ({ networkId }) =>
      networkAccount(networkId),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears the old amount immediately and quotes only a freshly entered ETH amount', async () => {
    const { result, rerender } = renderHook(useDepositForm, {
      initialProps: solanaUsdc,
    });
    act(() => result.current.setAmount('62.161578'));
    await act(async () => jest.advanceTimersByTime(800));
    expect(mockFetchQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fromNetworkId: 'sol--101',
        fromTokenAmount: '62.161578',
        userAddress: SOLANA_ADDRESS,
      }),
    );
    mockFetchQuote.mockClear();

    rerender(eth);
    expect(result.current.amount).toBe('');
    expect(result.current.tokenAmountBN.isZero()).toBe(true);
    expect(result.current.perpDepositQuote).toBeUndefined();
    await act(async () => jest.advanceTimersByTime(100));
    expect(mockFetchQuote).not.toHaveBeenCalled();

    act(() => result.current.setAmount('0.01'));
    await act(async () => jest.advanceTimersByTime(799));
    expect(mockFetchQuote).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    expect(mockFetchQuote).toHaveBeenCalledTimes(1);
    expect(mockFetchQuote).toHaveBeenLastCalledWith(
      expect.objectContaining({
        fromNetworkId: 'evm--1',
        fromTokenAddress: '',
        fromTokenAmount: '0.01',
        userAddress: EVM_ADDRESS,
        receivingAddress: EVM_ADDRESS,
      }),
    );
  });

  it('does not restore the old amount or quote after switching back before the debounce expires', async () => {
    const { result, rerender } = renderHook(useDepositForm, {
      initialProps: solanaUsdc,
    });
    act(() => result.current.setAmount('62.161578'));
    await act(async () => jest.advanceTimersByTime(800));
    expect(mockFetchQuote).toHaveBeenCalledTimes(1);
    mockFetchQuote.mockClear();

    rerender(eth);
    await act(async () => jest.advanceTimersByTime(100));
    rerender(solanaUsdc);
    await act(async () => jest.advanceTimersByTime(1000));
    expect(result.current.amount).toBe('');
    expect(result.current.perpDepositQuote).toBeUndefined();
    expect(mockFetchQuote).not.toHaveBeenCalled();
  });
});
