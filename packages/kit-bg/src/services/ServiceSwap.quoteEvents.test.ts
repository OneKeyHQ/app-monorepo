/* eslint-disable import/first */

type IMockEventSource = {
  addEventListener: jest.Mock;
  close: jest.Mock;
  headers: Record<string, string>;
  removeAllEventListeners: jest.Mock;
  url: string;
};

type IMockPolyfill = {
  onmessage?: (event: { data: string }) => void;
  onerror?: (event: { type: 'error'; error: string }) => Promise<void>;
  close: jest.Mock;
  headers: Record<string, string>;
  readyState: number;
};

const globalMockBag = globalThis as typeof globalThis & {
  __swapQuoteEventSources?: IMockEventSource[];
  __swapQuotePolyfills?: IMockPolyfill[];
};

jest.mock('event-source-polyfill', () => ({
  EventSourcePolyfill: jest
    .fn()
    .mockImplementation(
      (_url: string, options: { headers: Record<string, string> }) => {
        const source: IMockPolyfill = {
          close: jest.fn(),
          headers: options.headers,
          readyState: 2,
        };
        globalMockBag.__swapQuotePolyfills?.push(source);
        return source;
      },
    ),
}));

jest.mock('@onekeyhq/shared/src/eventSource', () => ({
  __esModule: true,
  default: class MockEventSource implements IMockEventSource {
    addEventListener = jest.fn();

    close = jest.fn();

    removeAllEventListeners = jest.fn();

    url: string;

    headers: Record<string, string>;

    constructor(url: string, options: { headers: Record<string, string> }) {
      this.url = url;
      this.headers = options.headers;
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

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import {
  ESwapQuoteSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

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
  const getUri = jest.fn(
    (_params: { url: string; params: Record<string, unknown> }) =>
      'https://example.com/swap/v1/quote/events',
  );
  jest.spyOn(service, 'getDenyCrossChainProvider').mockResolvedValue(undefined);
  jest.spyOn(service, 'getDenySingleSwapProvider').mockResolvedValue(undefined);
  jest.spyOn(service, 'getClient').mockResolvedValue({
    getUri,
  } as never);
  return { getUri, service };
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
    globalMockBag.__swapQuotePolyfills = [];
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
    delete globalMockBag.__swapQuoteEventSources;
    delete globalMockBag.__swapQuotePolyfills;
  });

  it('shares the selected XMR receiver with the cross-chain quote and blocks it on Web', async () => {
    const { getUri, service } = createService();
    const toTokenXmr: ISwapToken = {
      networkId: 'xmr--0',
      contractAddress: '',
      symbol: 'XMR',
      decimals: 12,
      isNative: true,
    };
    const primaryAddress = `4${'aB'.repeat(47)}`;
    const params = {
      ...createQuoteParams('xmr-quote'),
      toToken: toTokenXmr,
      receivingAddress: primaryAddress,
    };
    const isWeb = jest.replaceProperty(platformEnv, 'isWeb', true);
    try {
      await expect(service.fetchQuotesEvents(params)).rejects.toThrow(
        'Unsupported XMR swap route',
      );
      expect(getUri).not.toHaveBeenCalled();
      isWeb.replaceValue(false);
      await expect(
        service.fetchQuotesEvents({
          ...params,
          receivingAddress: `8${'aB'.repeat(47)}`,
        }),
      ).rejects.toThrow();
      expect(getUri).not.toHaveBeenCalled();

      await service.fetchQuotesEvents(params);
      expect(getUri).toHaveBeenCalledWith({
        url: '/swap/v1/quote/events',
        params: expect.objectContaining({
          receivingAddress: primaryAddress,
          toNetworkId: 'xmr--0',
        }),
      });
    } finally {
      await service.cancelFetchQuoteEvents(params.quoteRequestId);
      isWeb.restore();
    }
  });

  it.each([false, true])(
    'keeps the XMR quote error diagnostic separate from the request (extension: %s)',
    async (isExtension) => {
      const web = jest.replaceProperty(platformEnv, 'isWeb', false);
      const extension = jest.replaceProperty(
        platformEnv,
        'isExtension',
        isExtension,
      );
      const emit = jest.spyOn(appEventBus, 'emit');
      const { service } = createService();
      const quoteRequestId = 'xmr-quote-error';
      try {
        await service.fetchQuotesEvents({
          ...createQuoteParams(quoteRequestId),
          toToken: {
            networkId: 'xmr--0',
            contractAddress: '',
            symbol: 'XMR',
            decimals: 12,
            isNative: true,
          },
          receivingAddress: `4${'aB'.repeat(47)}`,
        });
        if (isExtension) {
          const source = globalMockBag.__swapQuotePolyfills?.[0];
          await source?.onerror?.({ type: 'error', error: 'upstream detail' });
        } else {
          const source = globalMockBag.__swapQuoteEventSources?.[0];
          const listener = source?.addEventListener.mock.calls.find(
            ([name]: [string]) => name === 'error',
          )?.[1] as
            | ((event: { type: string; url: string }) => void)
            | undefined;
          listener?.({ type: 'error', url: 'https://example.com/request' });
        }
        expect(emit).toHaveBeenCalledWith(
          EAppEventBusNames.SwapQuoteEvent,
          expect.objectContaining({
            quoteRequestId,
            type: 'error',
            event: {
              type: 'error',
              message: '',
              xhrState: expect.any(Number),
              xhrStatus: expect.any(Number),
            },
          }),
        );
      } finally {
        await service.cancelFetchQuoteEvents(quoteRequestId);
        emit.mockRestore();
        extension.restore();
        web.restore();
      }
    },
  );

  it.each([false, true])(
    'publishes the actual request currency even if settings change (extension: %s)',
    async (isExtension) => {
      jest.replaceProperty(platformEnv, 'isExtension', isExtension);
      const mockHeaders = jest.mocked(getRequestHeaders);
      mockHeaders.mockResolvedValueOnce({ 'x-onekey-request-currency': 'usd' });
      mockHeaders.mockResolvedValueOnce({ 'x-onekey-request-currency': 'cny' });
      const emit = jest.spyOn(appEventBus, 'emit');
      const { service } = createService();
      try {
        await service.fetchQuotesEvents(
          createQuoteParams('currency-request-usd'),
        );
        await service.fetchQuotesEvents(
          createQuoteParams('currency-request-cny'),
        );
        const sources = isExtension
          ? globalMockBag.__swapQuotePolyfills
          : globalMockBag.__swapQuoteEventSources;
        expect(sources?.[0]?.headers['x-onekey-request-currency']).toBe('usd');
        expect(sources?.[1]?.headers['x-onekey-request-currency']).toBe('cny');
        const payload = { data: JSON.stringify({ data: [] }) };
        if (isExtension) {
          globalMockBag.__swapQuotePolyfills?.[0]?.onmessage?.(payload);
          globalMockBag.__swapQuotePolyfills?.[1]?.onmessage?.(payload);
        } else {
          for (const source of globalMockBag.__swapQuoteEventSources ?? []) {
            const message = source.addEventListener.mock.calls.find(
              ([name]: [string]) => name === 'message',
            )?.[1] as ((event: { data: string }) => void) | undefined;
            message?.(payload);
          }
        }
        expect(emit).toHaveBeenCalledWith(
          EAppEventBusNames.SwapQuoteEvent,
          expect.objectContaining({
            type: 'message',
            quoteRequestId: 'currency-request-usd',
            quoteCurrency: 'usd',
          }),
        );
        expect(emit).toHaveBeenCalledWith(
          EAppEventBusNames.SwapQuoteEvent,
          expect.objectContaining({
            type: 'message',
            quoteRequestId: 'currency-request-cny',
            quoteCurrency: 'cny',
          }),
        );
      } finally {
        await service.cancelFetchQuoteEvents('currency-request-usd');
        await service.cancelFetchQuoteEvents('currency-request-cny');
        emit.mockRestore();
        jest.restoreAllMocks();
      }
    },
  );

  it('keeps independently owned quote streams active', async () => {
    const { service } = createService();
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

    expect(globalMockBag.__swapQuoteEventSources).toHaveLength(2);
    const firstEventSource = globalMockBag.__swapQuoteEventSources?.[1];
    await service.cancelFetchQuoteEvents('quote-request-1');
    expect(activeEventSource?.close).not.toHaveBeenCalled();
    expect(firstEventSource?.close).toHaveBeenCalledTimes(1);

    await service.cancelFetchQuoteEvents('quote-request-2');
    expect(activeEventSource?.close).toHaveBeenCalledTimes(1);
  });

  it('cancels a request while it is still preparing without affecting another request', async () => {
    const { service } = createService();
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
    await service.cancelFetchQuoteEvents('quote-request-1');
    await service.fetchQuotesEvents(createQuoteParams('quote-request-2'));

    resolveFirstPreparation?.(undefined);
    await firstRequest;

    expect(globalMockBag.__swapQuoteEventSources).toHaveLength(1);
    const activeEventSource = globalMockBag.__swapQuoteEventSources?.[0];
    expect(activeEventSource?.close).not.toHaveBeenCalled();
  });

  it('scopes Market requests except native BTC outbound routes', async () => {
    const { getUri, service } = createService();

    await service.fetchQuotesEvents({
      ...createQuoteParams('market-quote-request'),
      source: ESwapQuoteSource.MARKET,
    });

    expect(getUri).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/swap/v1/quote/events',
        params: expect.objectContaining({
          source: 'Market',
        }),
      }),
    );
    await service.cancelFetchQuoteEvents('market-quote-request');

    await service.fetchQuotesEvents({
      ...createQuoteParams('btc-market-quote-request'),
      source: ESwapQuoteSource.MARKET,
      fromToken: {
        ...fromToken,
        networkId: 'btc--0',
        contractAddress: '',
        symbol: 'BTC',
        isNative: true,
      },
    });

    const requestParams = getUri.mock.calls.at(-1)?.[0]?.params;
    expect(requestParams).not.toHaveProperty('source');
    await service.cancelFetchQuoteEvents('btc-market-quote-request');
  });

  it('omits empty optional quote amounts from the request', async () => {
    const { getUri, service } = createService();

    await service.fetchQuotesEvents({
      ...createQuoteParams('empty-amount-quote-request'),
      fromTokenAmount: '',
      toTokenAmount: '',
    });

    const requestParams = getUri.mock.calls[0]?.[0]?.params;
    expect(requestParams).not.toHaveProperty('fromTokenAmount');
    expect(requestParams).not.toHaveProperty('toTokenAmount');
    await service.cancelFetchQuoteEvents('empty-amount-quote-request');
  });

  it('keeps disabled single-swap providers in ordinary quote requests', async () => {
    const { getUri, service } = createService();
    jest
      .spyOn(service, 'getDenySingleSwapProvider')
      .mockResolvedValue('SwapOKX');
    await service.fetchQuotesEvents(
      createQuoteParams('ordinary-quote-request'),
    );
    expect(getUri.mock.calls[0]?.[0]?.params).toMatchObject({
      denySingleSwapProvider: 'SwapOKX',
    });
    await service.cancelFetchQuoteEvents('ordinary-quote-request');
  });

  it('keeps the cross-chain deny list for non-Sweep requests', async () => {
    const { getUri, service } = createService();
    jest
      .spyOn(service, 'getDenyCrossChainProvider')
      .mockResolvedValue('BridgeDisabled');
    await service.fetchQuotesEvents({
      ...createQuoteParams('bridge-quote-request'),
      toToken: { ...toToken, networkId: 'evm--56' },
    });
    expect(getUri.mock.calls[0]?.[0]?.params).toMatchObject({
      denyCrossChainProvider: 'BridgeDisabled',
    });
    await service.cancelFetchQuoteEvents('bridge-quote-request');
  });

  it('preserves Sweep source without sending provider restrictions', async () => {
    const { getUri, service } = createService();
    const getDenySingleSwapProvider = jest
      .spyOn(service, 'getDenySingleSwapProvider')
      .mockResolvedValue('SwapOKX,SwapLiquidMesh');

    await service.fetchQuotesEvents({
      ...createQuoteParams('sweep-quote-request'),
      source: ESwapQuoteSource.SWEEP,
      skipSingleSwapProviderDenyList: true,
    });

    expect(getUri).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/swap/v1/quote/events',
        params: expect.objectContaining({
          source: 'Sweep',
          protocol: 'Swap',
          fromTokenAmount: '1',
        }),
      }),
    );
    expect(getUri.mock.calls[0]?.[0]?.params).not.toHaveProperty(
      'denySingleSwapProvider',
    );
    expect(getDenySingleSwapProvider).not.toHaveBeenCalled();
    expect(getUri.mock.calls[0]?.[0]?.params).not.toHaveProperty(
      'skipSingleSwapProviderDenyList',
    );
    await service.cancelFetchQuoteEvents('sweep-quote-request');
  });
});
