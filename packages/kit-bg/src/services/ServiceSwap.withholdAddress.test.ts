import axios from 'axios';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
} from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

const xmrToken: ISwapToken = {
  networkId: 'xmr--0',
  contractAddress: '',
  decimals: 12,
  symbol: 'XMR',
  isNative: true,
  price: '200',
  accountAddress: 'server-address',
  balanceParsed: '999',
  fiatValue: '999',
};

const xmrAddress = `4${'a'.repeat(94)}`;

function createTokenService() {
  const getAccountAddressForApi = jest.fn().mockResolvedValue(xmrAddress);
  const getAccountXpub = jest.fn().mockResolvedValue('never-send');
  const getLocalWalletAccountBalance = jest.fn();
  const service = new ServiceSwap({
    backgroundApi: {
      serviceAccount: { getAccountAddressForApi, getAccountXpub },
      serviceAccountProfile: {
        _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
      },
      servicePrivacyChain: { getLocalWalletAccountBalance },
    },
  });
  const client = axios.create();
  const request = jest
    .spyOn(client, 'get')
    .mockResolvedValue({ data: { data: [xmrToken] } });
  jest.spyOn(service, 'getClient').mockResolvedValue(client);
  return {
    service,
    request,
    getAccountAddressForApi,
    getAccountXpub,
    getLocalWalletAccountBalance,
  };
}

describe('ServiceSwap address withholding', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('never sends a withholding chain address to the token detail endpoint', async () => {
    const service = new ServiceSwap({ backgroundApi: {} });
    const fetchDetails = jest
      .spyOn(service, 'fetchSwapTokenDetails')
      .mockResolvedValue([]);

    await expect(
      service.checkTokenPrivateSendSupported({
        networkId: 'xmr--0',
        contractAddress: '',
        accountAddress: '4own',
        accountId: 'hd-1--0',
      }),
    ).resolves.toBe(false);
    expect(fetchDetails).not.toHaveBeenCalled();
  });

  it('uses local spendable balance for XMR details and sends only public metadata parameters', async () => {
    const { service, request, getLocalWalletAccountBalance, getAccountXpub } =
      createTokenService();
    getLocalWalletAccountBalance.mockResolvedValue({
      total: '2000000000000',
      spendable: '1000000000001',
    });

    await expect(
      service.fetchSwapTokenDetails({
        networkId: 'xmr--0',
        contractAddress: '',
        accountAddress: xmrAddress,
        accountId: 'xmr-account',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        accountAddress: xmrAddress,
        balanceParsed: '1.000000000001',
        fiatValue: '200.0000000002',
      }),
    ]);
    expect(request.mock.calls[0]?.[1]?.params).toEqual({
      protocol: EProtocolOfExchange.SWAP,
      networkId: 'xmr--0',
      contractAddress: '',
      accountAddress: undefined,
      currency: undefined,
    });
    expect(getAccountXpub).not.toHaveBeenCalled();
    expect(getLocalWalletAccountBalance).toHaveBeenCalledWith({
      networkId: 'xmr--0',
      accountId: 'xmr-account',
    });
  });

  it('leaves spendable balance unknown when the selected XMR account changes', async () => {
    const { service, getAccountAddressForApi, getLocalWalletAccountBalance } =
      createTokenService();
    getAccountAddressForApi.mockResolvedValue('different-account');

    await expect(
      service.fetchSwapTokenDetails({
        networkId: 'xmr--0',
        contractAddress: '',
        accountAddress: xmrAddress,
        accountId: 'xmr-account',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        accountAddress: undefined,
        balanceParsed: undefined,
        fiatValue: undefined,
      }),
    ]);
    expect(getLocalWalletAccountBalance).not.toHaveBeenCalled();
  });

  it('discards the pending XMR spendable from a canceled detail request', async () => {
    const { service, request, getLocalWalletAccountBalance } =
      createTokenService();
    let notifyBalanceRead = () => {};
    const balanceReadStarted = new Promise<void>((resolve) => {
      notifyBalanceRead = resolve;
    });
    let finishBalanceRead = () => {};
    const pendingBalanceRead = new Promise<void>((resolve) => {
      finishBalanceRead = resolve;
    });
    getLocalWalletAccountBalance
      .mockImplementationOnce(async () => {
        notifyBalanceRead();
        await pendingBalanceRead;
        return { spendable: '9' };
      })
      .mockResolvedValueOnce({ spendable: '0' });

    const params = {
      networkId: 'xmr--0',
      contractAddress: '',
      accountAddress: xmrAddress,
      accountId: 'xmr-account',
      direction: ESwapDirectionType.FROM,
      throwOnError: true,
    };
    const first = service.fetchSwapTokenDetails(params);
    await balanceReadStarted;
    await expect(service.fetchSwapTokenDetails(params)).resolves.toEqual([
      expect.objectContaining({ balanceParsed: '0' }),
    ]);
    expect(request.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    finishBalanceRead();
    await expect(first).rejects.toThrow('Token detail canceled');
  });

  it('loads an XMR holding from local spendable and filters an unknown spendable from holdings', async () => {
    const { service, request, getLocalWalletAccountBalance } =
      createTokenService();
    getLocalWalletAccountBalance
      .mockResolvedValueOnce({ spendable: '5' })
      .mockResolvedValueOnce({ total: '5' });
    const params = {
      networkId: 'xmr--0',
      accountNetworkId: 'xmr--0',
      accountAddress: xmrAddress,
      accountId: 'xmr-account',
      onlyAccountTokens: true,
      currency: 'usd',
    };

    await expect(service.fetchSwapTokens(params)).resolves.toEqual([
      expect.objectContaining({
        balanceParsed: '0.000000000005',
        accountAddress: xmrAddress,
      }),
    ]);
    await expect(service.fetchSwapTokens(params)).resolves.toEqual([]);
    expect(request.mock.calls[0]?.[1]?.params).toEqual(
      expect.objectContaining({
        accountAddress: undefined,
        accountNetworkId: undefined,
        onlyAccountTokens: undefined,
      }),
    );
  });

  it('withholds a Monero primary address from another chain even without network scope', async () => {
    const {
      service,
      request,
      getAccountAddressForApi,
      getLocalWalletAccountBalance,
    } = createTokenService();
    const params = {
      networkId: 'evm--1',
      accountAddress: xmrAddress,
      accountId: 'xmr-account',
      currency: 'usd',
    };
    await service.fetchSwapTokens({ ...params, keywords: 'ETH' });
    await service.fetchSwapTokenDetails({ ...params, contractAddress: '' });
    expect(request).toHaveBeenCalledTimes(2);
    for (const [, options] of request.mock.calls) {
      expect(JSON.stringify(options?.params)).not.toContain(xmrAddress);
    }
    expect(getAccountAddressForApi).not.toHaveBeenCalled();
    expect(getLocalWalletAccountBalance).not.toHaveBeenCalled();
  });
});
