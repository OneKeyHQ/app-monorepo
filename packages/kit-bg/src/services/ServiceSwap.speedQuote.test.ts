import type {
  IFetchQuoteResult,
  IFetchSwapQuoteParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

import type { AxiosInstance } from 'axios';

type IRequest = {
  resolve: (value: {
    data: { code: number; data: IFetchQuoteResult[] };
  }) => void;
  signal: AbortSignal;
};

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  decimals: 6,
  symbol: 'FROM',
};
const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  decimals: 6,
  symbol: 'TO',
};

const quoteResult: IFetchQuoteResult = {
  protocol: EProtocolOfExchange.SWAP,
  info: { provider: 'provider', providerName: 'Provider' },
  fromTokenInfo: fromToken,
  toTokenInfo: toToken,
  fromAmount: '1',
  toAmount: '2',
};

function createQuoteParams(requestScopeKey: string): IFetchSwapQuoteParams {
  return {
    accountId: 'account-1',
    autoSlippage: true,
    fromToken,
    fromTokenAmount: '1',
    protocol: ESwapTabSwitchType.SWAP,
    requestScopeKey,
    slippagePercentage: 0.5,
    toToken,
    userAddress: '0xuser',
  };
}

function createServiceHarness() {
  const requests: IRequest[] = [];
  const get = jest.fn(
    (_url: string, config: { signal: AbortSignal }) =>
      new Promise<{
        data: { code: number; data: IFetchQuoteResult[] };
      }>((resolve) => {
        requests.push({ resolve, signal: config.signal });
      }),
  );
  const service = new ServiceSwap({
    backgroundApi: {
      serviceAccount: {
        getAccountDeviceSafe: jest.fn().mockResolvedValue(undefined),
      },
      serviceAccountProfile: {
        _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
      },
    },
  });
  jest
    .spyOn(service, 'getClient')
    .mockResolvedValue({ get } as unknown as AxiosInstance);
  return { requests, service };
}

async function waitForRequestCount(requests: IRequest[], count: number) {
  for (let attempt = 0; attempt < 20 && requests.length < count; attempt += 1) {
    await Promise.resolve();
  }
  expect(requests).toHaveLength(count);
}

function resolveRequest(request: IRequest) {
  request.resolve({ data: { code: 0, data: [quoteResult] } });
}

describe('ServiceSwap speed quote request ownership', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('keeps abort controllers isolated by request scope', async () => {
    const { requests, service } = createServiceHarness();

    const firstRequest = service.fetchSpeedSwapQuote(
      createQuoteParams('scope-1'),
    );
    await waitForRequestCount(requests, 1);
    const secondRequest = service.fetchSpeedSwapQuote(
      createQuoteParams('scope-2'),
    );
    await waitForRequestCount(requests, 2);

    expect(requests[0].signal.aborted).toBe(false);
    expect(requests[1].signal.aborted).toBe(false);

    await service.cancelFetchSpeedSwapQuote('scope-2');
    expect(requests[0].signal.aborted).toBe(false);
    expect(requests[1].signal.aborted).toBe(true);

    resolveRequest(requests[0]);
    resolveRequest(requests[1]);

    await expect(firstRequest).resolves.toEqual([quoteResult]);
    await expect(secondRequest).resolves.toEqual([quoteResult]);
  });

  it('aborts the previous request when the same scope restarts', async () => {
    const { requests, service } = createServiceHarness();

    const firstRequest = service.fetchSpeedSwapQuote(
      createQuoteParams('shared-scope'),
    );
    await waitForRequestCount(requests, 1);
    const secondRequest = service.fetchSpeedSwapQuote(
      createQuoteParams('shared-scope'),
    );
    await waitForRequestCount(requests, 2);

    expect(requests[0].signal.aborted).toBe(true);
    expect(requests[1].signal.aborted).toBe(false);

    resolveRequest(requests[0]);
    resolveRequest(requests[1]);

    await expect(firstRequest).resolves.toEqual([quoteResult]);
    await expect(secondRequest).resolves.toEqual([quoteResult]);
  });
});
