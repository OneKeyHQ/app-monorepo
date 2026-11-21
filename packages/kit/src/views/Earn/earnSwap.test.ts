import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IFetchSwapQuoteParams } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  EWrappedType,
} from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import { fetchEarnSwapQuote, prepareEarnWrap } from './earnSwap';

const mockFetch = jest.fn<Promise<void>, [IFetchSwapQuoteParams]>();
const mockCancel = jest.fn<Promise<void>, [string]>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchQuotesEvents: (params: IFetchSwapQuoteParams) => mockFetch(params),
      cancelFetchQuoteEvents: (id: string) => mockCancel(id),
    },
  },
}));

const inputToken: IToken = {
  address: '',
  isNative: true,
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
};
const wrappedToken: IToken = {
  address: EthereumWETH,
  isNative: false,
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
};
const owner = '0x1111111111111111111111111111111111111111';
const params = {
  accountId: 'account-1',
  networkId: 'evm--1',
  accountAddress: owner,
  inputToken,
  wrappedToken,
  amount: '1',
};

function emit(
  quoteRequestId: string,
  data: unknown,
  type: 'message' | 'done' = 'message',
) {
  const request = mockFetch.mock.calls[0]?.[0];
  if (!request) throw new OneKeyLocalError('Missing quote request');
  appEventBus.emit(EAppEventBusNames.SwapQuoteEvent, {
    quoteRequestId,
    type,
    event: {
      type: 'message',
      lastEventId: '',
      url: '',
      data: JSON.stringify(data),
    },
    accountId: request.accountId,
    tokenPairs: { fromToken: request.fromToken, toToken: request.toToken },
    params: {
      fromTokenAddress: request.fromToken.contractAddress,
      toTokenAddress: request.toToken.contractAddress,
      fromNetworkId: request.fromToken.networkId,
      toNetworkId: request.toToken.networkId,
      protocol: 'Swap',
      slippagePercentage: request.slippagePercentage,
    },
  });
}

function wrapQuote(overrides: Record<string, unknown> = {}) {
  const request = mockFetch.mock.calls[0]?.[0];
  if (!request) throw new OneKeyLocalError('Missing quote request');
  return {
    info: { provider: 'wrapped' },
    fromTokenInfo: {
      networkId: request.fromToken.networkId,
      contractAddress: request.fromToken.contractAddress,
      isNative: request.fromToken.isNative,
      decimals: request.fromToken.decimals,
    },
    toTokenInfo: {
      networkId: request.toToken.networkId,
      contractAddress: request.toToken.contractAddress,
      isNative: request.toToken.isNative,
      decimals: request.toToken.decimals,
    },
    fromAmount: '1',
    toAmount: '1',
    isWrapped: true,
    fee: { percentageFee: 0 },
    ...overrides,
  };
}

describe('Earn swap wrap quote', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockFetch.mockResolvedValue();
    mockCancel.mockResolvedValue();
  });

  it('ignores other sessions and providers, then confirms the matching wrap quote', async () => {
    const promise = prepareEarnWrap({
      ...params,
      signal: new AbortController().signal,
    });
    const request = mockFetch.mock.calls[0]?.[0];
    if (!request?.quoteRequestId)
      throw new OneKeyLocalError('Missing quote id');
    expect(request.cancelOnGlobalStop).toBe(false);
    emit('another-session', { data: [wrapQuote()] });
    emit(request.quoteRequestId, { errorMessage: 'another provider failed' });
    emit(request.quoteRequestId, {
      data: [wrapQuote({ info: { provider: 'other' } })],
    });
    emit(request.quoteRequestId, { data: [wrapQuote()] });
    await expect(promise).resolves.toEqual({
      from: owner,
      amount: '1',
      contract: EthereumWETH,
      type: EWrappedType.DEPOSIT,
    });
    expect(mockCancel).toHaveBeenCalledWith(request.quoteRequestId);
  });

  it('matches an identical native address when the quote omits the optional native flag', async () => {
    const promise = prepareEarnWrap({
      ...params,
      signal: new AbortController().signal,
    });
    const request = mockFetch.mock.calls[0]?.[0];
    if (!request?.quoteRequestId)
      throw new OneKeyLocalError('Missing quote id');
    emit(request.quoteRequestId, {
      data: [
        wrapQuote({
          fromTokenInfo: {
            networkId: request.fromToken.networkId,
            contractAddress: request.fromToken.contractAddress,
          },
        }),
      ],
    });
    await expect(promise).resolves.toEqual(
      expect.objectContaining({ contract: EthereumWETH }),
    );
  });

  it.each([
    ['evm--8453', '0x4200000000000000000000000000000000000006'],
    ['evm--42161', '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'],
  ])(
    'quotes the registered native wrap pair on %s',
    async (networkId, address) => {
      const promise = prepareEarnWrap({
        ...params,
        networkId,
        inputToken: { ...inputToken, networkId },
        wrappedToken: { ...wrappedToken, networkId, address },
        signal: new AbortController().signal,
      });
      const request = mockFetch.mock.calls[0]?.[0];
      if (!request?.quoteRequestId)
        throw new OneKeyLocalError('Missing quote id');
      expect(request.fromToken.networkId).toBe(networkId);
      expect(request.toToken.contractAddress).toBe(address);
      emit(request.quoteRequestId, { data: [wrapQuote()] });
      await expect(promise).resolves.toEqual(
        expect.objectContaining({
          from: owner,
          amount: '1',
          contract: address,
        }),
      );
    },
  );

  it.each([
    { toAmount: '0.9' },
    { isWrapped: false },
    { fee: { percentageFee: 1 } },
    {
      toTokenInfo: {
        networkId: 'evm--1',
        contractAddress: '0xother',
        isNative: false,
      },
    },
  ])('rejects a mismatched or unsafe wrap quote: %p', async (overrides) => {
    const promise = prepareEarnWrap({
      ...params,
      signal: new AbortController().signal,
    });
    const id = mockFetch.mock.calls[0]?.[0].quoteRequestId;
    if (!id) throw new OneKeyLocalError('Missing quote id');
    emit(id, { data: [wrapQuote(overrides)] });
    emit(id, {}, 'done');
    await expect(promise).rejects.toThrow('No matching Earn swap quote');
  });

  it('cancels its own request when the action is aborted', async () => {
    const controller = new AbortController();
    const promise = prepareEarnWrap({ ...params, signal: controller.signal });
    const id = mockFetch.mock.calls[0]?.[0].quoteRequestId;
    controller.abort();
    await expect(promise).rejects.toThrow('cancelled');
    expect(mockCancel).toHaveBeenCalledWith(id);
  });

  it('does not quote an amount that exceeds the native token precision', async () => {
    await expect(
      prepareEarnWrap({
        ...params,
        amount: '0.0000000000000000001',
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('Invalid Earn wrap request');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('cleans up again if cancellation races with background request startup', async () => {
    let completeStartup: (() => void) | undefined;
    mockFetch.mockReturnValue(
      new Promise<void>((resolve) => {
        completeStartup = resolve;
      }),
    );
    const controller = new AbortController();
    const promise = prepareEarnWrap({ ...params, signal: controller.signal });
    const id = mockFetch.mock.calls[0]?.[0].quoteRequestId;
    controller.abort();
    await expect(promise).rejects.toThrow('cancelled');
    expect(mockCancel).toHaveBeenCalledTimes(1);
    completeStartup?.();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(mockCancel).toHaveBeenCalledTimes(2);
    expect(mockCancel).toHaveBeenLastCalledWith(id);
  });

  it('forwards bridge quote configuration and selects the configured provider', async () => {
    const source = {
      networkId: 'evm--1',
      contractAddress: '',
      isNative: true,
      symbol: 'ETH',
      decimals: 18,
    };
    const destination = {
      networkId: 'evm--10',
      contractAddress: '0xabc',
      isNative: false,
      symbol: 'TOKEN',
      decimals: 18,
    };
    const promise = fetchEarnSwapQuote({
      config: {
        accountId: params.accountId,
        userAddress: owner,
        receivingAddress: owner,
        fromToken: source,
        toToken: destination,
        fromTokenAmount: '1',
        protocol: ESwapTabSwitchType.BRIDGE,
        kind: ESwapQuoteKind.SELL,
        slippagePercentage: 0.5,
        denySingleSwapProvider: 'disabled-provider',
        allowedProviders: ['SwapLifi'],
      },
      signal: new AbortController().signal,
    });
    const request = mockFetch.mock.calls[0]?.[0];
    if (!request?.quoteRequestId)
      throw new OneKeyLocalError('Missing quote id');
    expect(request).toEqual(
      expect.objectContaining({
        protocol: ESwapTabSwitchType.BRIDGE,
        denySingleSwapProvider: 'disabled-provider',
        slippagePercentage: 0.5,
        receivingAddress: owner,
      }),
    );
    emit(request.quoteRequestId, {
      data: [wrapQuote({ info: { provider: 'other' } })],
    });
    emit(request.quoteRequestId, {
      data: [
        wrapQuote({
          info: { provider: 'SwapLifi' },
          protocol: EProtocolOfExchange.SWAP,
        }),
      ],
    });
    await expect(promise).resolves.toEqual(
      expect.objectContaining({ info: { provider: 'SwapLifi' } }),
    );
  });

  it('rejects a differently cased Solana token address before accepting an exact match', async () => {
    const solAddress = 'So11111111111111111111111111111111111111112';
    const source = {
      networkId: 'sol--101',
      contractAddress: solAddress,
      isNative: false,
      symbol: 'TOKEN',
      decimals: 9,
    };
    const destination = {
      networkId: 'evm--1',
      contractAddress: '0x1234',
      isNative: false,
      symbol: 'TOKEN',
      decimals: 18,
    };
    const promise = fetchEarnSwapQuote({
      config: {
        accountId: params.accountId,
        userAddress: owner,
        receivingAddress: owner,
        fromToken: source,
        toToken: destination,
        fromTokenAmount: '1',
        protocol: ESwapTabSwitchType.BRIDGE,
        kind: ESwapQuoteKind.SELL,
        slippagePercentage: 0.5,
        allowedProviders: ['SwapLifi'],
      },
      signal: new AbortController().signal,
    });
    const id = mockFetch.mock.calls[0]?.[0].quoteRequestId;
    if (!id) throw new OneKeyLocalError('Missing quote id');
    emit(id, {
      data: [
        wrapQuote({
          info: { provider: 'SwapLifi' },
          fromTokenInfo: {
            ...source,
            contractAddress: `s${solAddress.slice(1)}`,
          },
        }),
      ],
    });
    emit(id, {
      data: [
        wrapQuote({
          info: { provider: 'SwapLifi' },
          fromTokenInfo: source,
        }),
      ],
    });
    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        fromTokenInfo: expect.objectContaining({ contractAddress: solAddress }),
      }),
    );
  });

  it('accepts an EVM token address with different checksum casing', async () => {
    const source = {
      networkId: 'evm--1',
      contractAddress: '0xAbCd',
      isNative: false,
      symbol: 'TOKEN',
      decimals: 18,
    };
    const destination = {
      networkId: 'evm--10',
      contractAddress: '0x1234',
      isNative: false,
      symbol: 'TOKEN',
      decimals: 18,
    };
    const promise = fetchEarnSwapQuote({
      config: {
        accountId: params.accountId,
        userAddress: owner,
        receivingAddress: owner,
        fromToken: source,
        toToken: destination,
        fromTokenAmount: '1',
        protocol: ESwapTabSwitchType.BRIDGE,
        kind: ESwapQuoteKind.SELL,
        slippagePercentage: 0.5,
        allowedProviders: ['SwapLifi'],
      },
      signal: new AbortController().signal,
    });
    const id = mockFetch.mock.calls[0]?.[0].quoteRequestId;
    if (!id) throw new OneKeyLocalError('Missing quote id');
    emit(id, {
      data: [
        wrapQuote({
          info: { provider: 'SwapLifi' },
          fromTokenInfo: { ...source, contractAddress: '0xabcd' },
        }),
      ],
    });
    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        fromTokenInfo: expect.objectContaining({ contractAddress: '0xabcd' }),
      }),
    );
  });
});
