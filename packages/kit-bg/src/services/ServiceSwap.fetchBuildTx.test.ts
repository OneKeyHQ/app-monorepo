import type { IIpTableRequestConfig } from '@onekeyhq/shared/src/request/helpers/ipTableAdapter';
import type {
  IFetchBuildTxResponse,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
} from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

import type { AxiosInstance } from 'axios';

describe('ServiceSwap.fetchBuildTx IP Table fallback policy', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  const walletTypeHeaders = { 'X-Wallet-Type': 'hd' };
  const getWalletTypeHeader = jest.fn().mockResolvedValue(walletTypeHeaders);

  const token: ISwapToken = {
    contractAddress: '0xtoken',
    decimals: 18,
    isNative: false,
    networkId: 'evm--1',
    symbol: 'TOKEN',
  };

  const request: Parameters<ServiceSwap['fetchBuildTx']>[0] = {
    accountId: 'account-1',
    fromToken: token,
    fromTokenAmount: '1',
    kind: ESwapQuoteKind.SELL,
    protocol: EProtocolOfExchange.SWAP,
    provider: 'provider-1',
    quoteResultCtx: { quoteId: 'quote-1' },
    receivingAddress: '0xreceiver',
    slippagePercentage: 0.5,
    toToken: token,
    toTokenAmount: '0.9',
    userAddress: '0xsender',
  };

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService(post: jest.Mock) {
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: getWalletTypeHeader,
        },
      },
    });
    jest
      .spyOn(service, 'getClient')
      .mockResolvedValue({ post } as unknown as AxiosInstance);
    return service;
  }

  it('fails closed after the SNI attempt for Private Send build requests', async () => {
    const response = { orderId: 'private-order-1' } as IFetchBuildTxResponse;
    const post = jest.fn().mockResolvedValue({ data: { data: response } });
    const service = createService(post);

    await expect(
      service.fetchBuildTx({
        ...request,
        protocol: EProtocolOfExchange.PRIVATE_SEND,
      }),
    ).resolves.toBe(response);

    const config = post.mock.calls[0][2] as IIpTableRequestConfig;
    expect(config).toMatchObject({
      headers: walletTypeHeaders,
      ipTableFailClosedAfterSniAttempt: true,
    });
  });

  it('does not change the fallback policy for ordinary Swap build requests', async () => {
    const response = { orderId: 'swap-order-1' } as IFetchBuildTxResponse;
    const post = jest.fn().mockResolvedValue({ data: { data: response } });
    const service = createService(post);

    await expect(service.fetchBuildTx(request)).resolves.toBe(response);

    const config = post.mock.calls[0][2] as IIpTableRequestConfig;
    expect(config).toMatchObject({ headers: walletTypeHeaders });
    expect(config).not.toHaveProperty('ipTableFailClosedAfterSniAttempt');
  });
});
