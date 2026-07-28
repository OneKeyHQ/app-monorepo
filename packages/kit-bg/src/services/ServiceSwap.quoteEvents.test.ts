/* eslint-disable import/first */

type IMockEventSource = {
  addEventListener: jest.Mock;
  close: jest.Mock;
  removeAllEventListeners: jest.Mock;
  url: string;
};

const globalMockBag = globalThis as typeof globalThis & {
  __swapQuoteEventSources?: IMockEventSource[];
};

jest.mock('@onekeyhq/shared/src/eventSource', () => ({
  __esModule: true,
  default: class MockEventSource implements IMockEventSource {
    addEventListener = jest.fn();

    close = jest.fn();

    removeAllEventListeners = jest.fn();

    url: string;

    constructor(url: string) {
      this.url = url;
      globalMockBag.__swapQuoteEventSources?.push(this);
    }
  },
}));

jest.mock('@onekeyhq/shared/src/request/Interceptor', () => ({
  getRequestHeaders: jest.fn(async () => ({})),
}));

jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: jest.fn(
    async (_url: string, headers: Record<string, string>) => headers,
  ),
}));

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

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

function createService() {
  const service = new ServiceSwap({
    backgroundApi: {
      serviceAccount: {
        getAccountDeviceSafe: jest.fn().mockResolvedValue(undefined),
      },
      serviceAccountProfile: {
        _getRequestWalletType: jest.fn().mockResolvedValue(''),
      },
    },
  });
  jest.spyOn(service, 'getDenySingleSwapProvider').mockResolvedValue(undefined);
  jest.spyOn(service, 'getClient').mockResolvedValue({
    getUri: jest.fn(() => 'https://example.com/swap/v1/quote/events'),
  } as never);
  return service;
}

function createQuoteParams(quoteRequestId: string) {
  return {
    accountId: 'account-1',
    autoSlippage: true,
    fromToken,
    fromTokenAmount: '1',
    incognito: false,
    protocol: ESwapTabSwitchType.SWAP,
    quoteRequestId,
    slippagePercentage: 0.5,
    toToken,
    userAddress: '0xuser',
  };
}

describe('ServiceSwap quote event request ownership', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  beforeEach(() => {
    globalMockBag.__swapQuoteEventSources = [];
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
    delete globalMockBag.__swapQuoteEventSources;
  });

  it('does not let an older preparation or cancellation replace the active stream', async () => {
    const service = createService();
    let resolveFirstPreparation: ((value: undefined) => void) | undefined;
    const firstPreparation = new Promise<undefined>((resolve) => {
      resolveFirstPreparation = resolve;
    });
    jest
      .spyOn(service, 'getDenyCrossChainProvider')
      .mockReturnValueOnce(firstPreparation)
      .mockResolvedValue(undefined);

    const firstRequest = service.fetchQuotesEvents(
      createQuoteParams('quote-request-1'),
    );
    await Promise.resolve();
    await service.fetchQuotesEvents(createQuoteParams('quote-request-2'));

    expect(globalMockBag.__swapQuoteEventSources).toHaveLength(1);
    const activeEventSource = globalMockBag.__swapQuoteEventSources?.[0];
    expect(activeEventSource).toBeDefined();

    resolveFirstPreparation?.(undefined);
    await firstRequest;

    expect(globalMockBag.__swapQuoteEventSources).toHaveLength(1);
    await service.cancelFetchQuoteEvents('quote-request-1');
    expect(activeEventSource?.close).not.toHaveBeenCalled();

    await service.cancelFetchQuoteEvents('quote-request-2');
    expect(activeEventSource?.close).toHaveBeenCalledTimes(1);
  });
});
