import { buildSwapQuoteExecutionFingerprint } from '@onekeyhq/shared/src/utils/swapQuoteFingerprint';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchSwapQuoteParams,
  ISwapQuoteSessionIdentity,
  ISwapSpeedQuoteSessionIdentity,
} from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

import type { AxiosInstance } from 'axios';

const request: IFetchSwapQuoteParams = {
  fromToken: {
    networkId: 'evm--1',
    contractAddress: '',
    isNative: true,
    symbol: 'ETH',
    decimals: 18,
  },
  toToken: {
    networkId: 'evm--1',
    contractAddress: '0xusdc',
    isNative: false,
    symbol: 'USDC',
    decimals: 6,
  },
  fromTokenAmount: '1',
  userAddress: '0xsender',
  receivingAddress: '0xreceiver',
  slippagePercentage: 0.5,
  accountId: 'account-1',
  protocol: ESwapTabSwitchType.SWAP,
};

function buildQuoteSession(): ISwapQuoteSessionIdentity {
  return {
    surfaceId: 'main:swap',
    requestId: 'request-1',
    fingerprint: buildSwapQuoteExecutionFingerprint(request),
    intentRevision: 1,
  };
}

function buildSpeedSession(): ISwapSpeedQuoteSessionIdentity {
  return {
    surfaceId: 'main:speed',
    requestId: 'request-1',
    fingerprint: buildSwapQuoteExecutionFingerprint(request),
    intentRevision: 1,
  };
}

function createService(get = jest.fn()) {
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
  const getClientSpy = jest
    .spyOn(service, 'getClient')
    .mockResolvedValue({ get } as unknown as AxiosInstance);
  return { get, getClientSpy, service };
}

describe('ServiceSwap V2 request identity', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('rejects and retires an ordinary quote lease whose request does not match its fingerprint', async () => {
    const { getClientSpy, service } = createService();
    const session = buildQuoteSession();
    const mismatchedRequest = { ...request, slippagePercentage: 1 };

    await expect(
      service.fetchQuotesEventsV2({ session, request: mismatchedRequest }),
    ).resolves.toEqual(expect.objectContaining({ accepted: false, session }));
    await expect(
      service.fetchQuotesEventsV2({ session, request }),
    ).resolves.toEqual(expect.objectContaining({ accepted: false, session }));
    expect(getClientSpy).not.toHaveBeenCalled();
  });

  it('rejects and retires a speed quote lease whose request does not match its fingerprint', async () => {
    const { getClientSpy, service } = createService();
    const session = buildSpeedSession();
    const mismatchedRequest = { ...request, receivingAddress: '0xchanged' };

    await expect(
      service.fetchSpeedSwapQuoteV2({ session, request: mismatchedRequest }),
    ).resolves.toEqual(expect.objectContaining({ accepted: false, session }));
    await expect(
      service.fetchSpeedSwapQuoteV2({ session, request }),
    ).resolves.toEqual(expect.objectContaining({ accepted: false, session }));
    expect(getClientSpy).not.toHaveBeenCalled();
  });

  it('keeps a successful zero-provider speed response distinct from failure', async () => {
    const get = jest.fn().mockResolvedValue({
      data: { code: 0, data: [] },
    });
    const { service } = createService(get);
    const session = buildSpeedSession();

    await expect(
      service.fetchSpeedSwapQuoteV2({ session, request }),
    ).resolves.toEqual({
      accepted: true,
      session,
      bgGeneration: 1,
      quotes: [],
    });
  });

  it('propagates speed transport and server failures instead of synthesizing an empty-provider quote', async () => {
    const transportError = new Error('network unavailable');
    const transport = createService(
      jest.fn().mockRejectedValue(transportError),
    );
    await expect(
      transport.service.fetchSpeedSwapQuoteV2({
        session: buildSpeedSession(),
        request,
      }),
    ).rejects.toBe(transportError);

    const server = createService(
      jest.fn().mockResolvedValue({
        data: { code: 500, data: [], message: 'provider service failed' },
      }),
    );
    await expect(
      server.service.fetchSpeedSwapQuoteV2({
        session: buildSpeedSession(),
        request,
      }),
    ).rejects.toMatchObject({ message: 'provider service failed' });
  });
});
