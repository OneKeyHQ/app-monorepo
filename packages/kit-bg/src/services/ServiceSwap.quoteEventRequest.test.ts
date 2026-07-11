/** @jest-environment node */

import EventSource from '@onekeyhq/shared/src/eventSource';
import type { IFetchSwapQuoteParams } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (constructor: unknown) => constructor,
  backgroundMethod:
    () =>
    (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () =>
    (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventSource', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addEventListener: jest.fn(),
    close: jest.fn(),
    removeAllEventListeners: jest.fn(),
  })),
}));

jest.mock('@onekeyhq/shared/src/request/Interceptor', () => ({
  getRequestHeaders: jest.fn().mockResolvedValue({}),
}));

jest.mock('@onekeyhq/shared/src/request/customUA', () => ({
  withCustomUAHeaders: jest
    .fn()
    .mockImplementation(
      async (_url: string, headers: Record<string, string>) => headers,
    ),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function buildQuoteParams(toTokenAddress: string): IFetchSwapQuoteParams {
  return {
    accountId: 'account-1',
    autoSlippage: true,
    fromToken: {
      contractAddress: '',
      decimals: 18,
      isNative: true,
      networkId: 'evm--56',
      symbol: 'BNB',
    },
    fromTokenAmount: '1',
    protocol: ESwapTabSwitchType.SWAP,
    slippagePercentage: 0.5,
    toToken: {
      contractAddress: toTokenAddress,
      decimals: 18,
      isNative: false,
      networkId: 'evm--56',
      symbol: 'TOKEN',
    },
    userAddress: '0xaccount',
  };
}

function createService() {
  const backgroundApi = {
    serviceAccount: {
      getAccountDeviceSafe: jest.fn().mockResolvedValue(undefined),
    },
    serviceAccountProfile: {
      _getRequestWalletType: jest.fn().mockResolvedValue('hd'),
    },
  };
  const service = new ServiceSwap({ backgroundApi });
  jest.spyOn(service, 'getDenySingleSwapProvider').mockResolvedValue(undefined);
  jest.spyOn(service as never, 'getClient').mockResolvedValue({
    getUri: ({ params }: { params: { toTokenAddress: string } }) =>
      `https://swap.test/${params.toTokenAddress}`,
  } as never);
  return service;
}

describe('ServiceSwap quote event request ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not let an older preflight replace the latest EventSource', async () => {
    const stalePreflight = createDeferred<string | undefined>();
    const service = createService();
    jest
      .spyOn(service, 'getDenyCrossChainProvider')
      .mockImplementationOnce(() => stalePreflight.promise)
      .mockResolvedValue(undefined);

    const staleRequest = service.fetchQuotesEvents(buildQuoteParams('0xstale'));
    await Promise.resolve();
    await service.fetchQuotesEvents(buildQuoteParams('0xlatest'));

    expect(EventSource).toHaveBeenCalledTimes(1);
    expect(EventSource).toHaveBeenLastCalledWith(
      'https://swap.test/0xlatest',
      expect.any(Object),
    );

    stalePreflight.resolve(undefined);
    await staleRequest;

    expect(EventSource).toHaveBeenCalledTimes(1);
  });

  it('does not install an EventSource after cancellation', async () => {
    const stalePreflight = createDeferred<string | undefined>();
    const service = createService();
    jest
      .spyOn(service, 'getDenyCrossChainProvider')
      .mockImplementationOnce(() => stalePreflight.promise);

    const staleRequest = service.fetchQuotesEvents(
      buildQuoteParams('0xcancelled'),
    );
    await Promise.resolve();
    await service.cancelFetchQuoteEvents();
    stalePreflight.resolve(undefined);
    await staleRequest;

    expect(EventSource).not.toHaveBeenCalled();
  });
});
