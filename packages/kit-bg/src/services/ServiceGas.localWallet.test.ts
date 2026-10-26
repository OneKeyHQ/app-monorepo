/* eslint-disable import/first */
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
const mockSettingsGet = jest.fn<
  Promise<{
    currencyInfo?: { id: string };
    useGasAccountByDefault?: boolean;
  }>,
  []
>();
jest.mock('../states/jotai/atoms/settings', () => ({
  settingsPersistAtom: { get: () => mockSettingsGet() },
}));
jest.mock('../vaults/impls/fil/utils', () => ({ FIL_MIN_BASE_FEE: '0' }));
const mockIsLocalWalletNetwork = jest.fn<Promise<boolean>, []>();
jest.mock('../vaults/localWallet/isLocalWalletNetwork', () => ({
  isLocalWalletNetwork: () => mockIsLocalWalletNetwork(),
}));
const mockEstimateFee = jest.fn();
const mockGetNetwork = jest.fn();
const mockFetchTokenDetails = jest.fn<
  Promise<{
    data: {
      data: {
        info: { address: string; isNative?: boolean };
        price: string | number;
      }[];
    };
  }>,
  [IFetchServerTokenDetailParams]
>();
const mockGetChainOnlyVault = jest.fn<
  Promise<{ fetchTokenDetails: typeof mockFetchTokenDetails }>,
  [{ networkId: string }]
>();
jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: async () => ({
      estimateFee: mockEstimateFee,
      getNetwork: mockGetNetwork,
    }),
    getChainOnlyVault: (...args: Parameters<typeof mockGetChainOnlyVault>) =>
      mockGetChainOnlyVault(...args),
  },
}));
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IEstimateGasParams } from '@onekeyhq/shared/types/fee';
import type { IFetchServerTokenDetailParams } from '@onekeyhq/shared/types/serverToken';

import ServiceGas from './ServiceGas';

describe('local wallet fee fiat metadata', () => {
  const params = {
    accountId: 'account',
    accountAddress: 't1-own',
    networkId: 'zec--0',
    encodedTx: {
      nonce: '1',
      gas: '21000',
      gasPrice: '1',
      to: 't1-test',
      value: '1',
      data: '0x',
    },
  } as IEstimateGasParams;
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsGet.mockResolvedValue({ currencyInfo: { id: 'usd' } });
    mockIsLocalWalletNetwork.mockResolvedValue(true);
    mockGetNetwork.mockResolvedValue({ backendIndex: false });
    mockGetChainOnlyVault.mockResolvedValue({
      fetchTokenDetails: mockFetchTokenDetails,
    });
    mockFetchTokenDetails.mockResolvedValue({
      data: {
        data: [{ info: { address: '', isNative: true }, price: '1190.66' }],
      },
    });
    mockEstimateFee.mockResolvedValue({
      data: { data: { feeUTXO: [{ feeValue: '0.0001' }] } },
    });
  });

  it('queries only the asset identity and uses the selected currency price', async () => {
    const fetchMarketTokenDetailByTokenAddress = jest.fn(async () => ({
      data: { token: { price: '40', priceConverted: '6000' } },
    }));
    const service = new ServiceGas({
      backgroundApi: {
        serviceMarketV2: { fetchMarketTokenDetailByTokenAddress },
      },
    });
    expect((await service.estimateFee(params)).common.nativeTokenPrice).toBe(
      6000,
    );
    expect(fetchMarketTokenDetailByTokenAddress).toHaveBeenCalledWith(
      '',
      'zec--0',
      { autoHandleError: false },
    );
    expect(mockEstimateFee).toHaveBeenCalledWith(params);
  });

  it('does not turn a missing quote into zero or block a locally priced send', async () => {
    const fetchMarketTokenDetailByTokenAddress = jest.fn(async () => {
      throw new OneKeyLocalError('offline');
    });
    const service = new ServiceGas({
      backgroundApi: {
        serviceMarketV2: { fetchMarketTokenDetailByTokenAddress },
      },
    });
    const result = await service.estimateFee(params);
    expect(result.common.nativeTokenPrice).toBeUndefined();
    expect(result.feeUTXO).toEqual([{ feeValue: '0.0001' }]);
  });

  function indexedService() {
    mockGetNetwork.mockResolvedValue({ backendIndex: true });
    const getNativeTokenAddress = jest.fn(async () => '');
    const fetchMarketTokenDetailByTokenAddress = jest.fn();
    const service = new ServiceGas({
      backgroundApi: {
        serviceToken: { getNativeTokenAddress },
        serviceMarketV2: { fetchMarketTokenDetailByTokenAddress },
      },
    });
    return {
      service,
      getNativeTokenAddress,
      fetchMarketTokenDetailByTokenAddress,
    };
  }

  it('uses account-free wallet pricing for indexed native assets when market detail is unsupported', async () => {
    const {
      service,
      getNativeTokenAddress,
      fetchMarketTokenDetailByTokenAddress,
    } = indexedService();
    fetchMarketTokenDetailByTokenAddress.mockRejectedValue(
      new OneKeyLocalError('30011'),
    );
    const result = await service.estimateFee(params);
    expect(result.common.nativeTokenPrice).toBe(1190.66);
    expect(result.feeUTXO).toEqual([{ feeValue: '0.0001' }]);
    expect(mockGetChainOnlyVault).toHaveBeenCalledWith({ networkId: 'zec--0' });
    expect(getNativeTokenAddress).toHaveBeenCalledWith({ networkId: 'zec--0' });
    expect(mockFetchTokenDetails).toHaveBeenCalledWith({
      networkId: 'zec--0',
      contractList: [''],
      requestCurrency: 'usd',
    });
    expect(fetchMarketTokenDetailByTokenAddress).not.toHaveBeenCalled();
  });

  it('pins each wallet quote to the selected currency after a currency switch', async () => {
    const { service } = indexedService();
    mockSettingsGet.mockResolvedValueOnce({ currencyInfo: { id: 'usd' } });
    mockSettingsGet.mockResolvedValueOnce({ currencyInfo: { id: 'cny' } });
    mockFetchTokenDetails.mockResolvedValueOnce({
      data: { data: [{ info: { address: '' }, price: '1190.66' }] },
    });
    mockFetchTokenDetails.mockResolvedValueOnce({
      data: { data: [{ info: { address: '' }, price: '7946.46' }] },
    });
    expect((await service.estimateFee(params)).common.nativeTokenPrice).toBe(
      1190.66,
    );
    expect((await service.estimateFee(params)).common.nativeTokenPrice).toBe(
      7946.46,
    );
    expect(mockFetchTokenDetails.mock.calls.map(([query]) => query)).toEqual([
      { networkId: 'zec--0', contractList: [''], requestCurrency: 'usd' },
      { networkId: 'zec--0', contractList: [''], requestCurrency: 'cny' },
    ]);
  });

  it('uses only the requested native asset and preserves Gas Account opt-out', async () => {
    const { service } = indexedService();
    mockSettingsGet.mockResolvedValue({ useGasAccountByDefault: false });
    mockFetchTokenDetails.mockResolvedValue({
      data: {
        data: [
          { info: { address: 'other-asset' }, price: 999 },
          { info: { address: '' }, price: 42 },
        ],
      },
    });
    expect((await service.estimateFee(params)).common.nativeTokenPrice).toBe(
      42,
    );
    expect(mockEstimateFee).toHaveBeenCalledWith({
      ...params,
      gasAccountEnabled: false,
    });
    expect(mockFetchTokenDetails).toHaveBeenCalledWith({
      networkId: 'zec--0',
      contractList: [''],
      requestCurrency: 'usd',
    });
  });

  it.each(['', 'NaN', 'Infinity', '0', '-1'])(
    'keeps the native fee when the wallet price is unusable (%s)',
    async (price) => {
      const { service } = indexedService();
      mockFetchTokenDetails.mockResolvedValue({
        data: { data: [{ info: { address: '' }, price }] },
      });
      const result = await service.estimateFee(params);
      expect(result.common.nativeTokenPrice).toBeUndefined();
      expect(result.feeUTXO).toEqual([{ feeValue: '0.0001' }]);
    },
  );

  it('does not block a send when the wallet quote fails', async () => {
    const { service } = indexedService();
    mockFetchTokenDetails.mockRejectedValueOnce(
      new OneKeyLocalError('offline'),
    );
    const result = await service.estimateFee(params);
    expect(result.common.nativeTokenPrice).toBeUndefined();
    expect(result.feeUTXO).toEqual([{ feeValue: '0.0001' }]);
  });

  it('preserves a supplied price and skips all fallback quote requests', async () => {
    const { service } = indexedService();
    mockEstimateFee.mockResolvedValue({
      data: { data: { nativeTokenPrice: { price: 12 } } },
    });
    expect((await service.estimateFee(params)).common.nativeTokenPrice).toBe(
      12,
    );
    expect(mockGetNetwork).not.toHaveBeenCalled();
    expect(mockGetChainOnlyVault).not.toHaveBeenCalled();
  });

  it('leaves non-local fee pricing unchanged', async () => {
    const { service } = indexedService();
    mockIsLocalWalletNetwork.mockResolvedValueOnce(false);
    expect(
      (await service.estimateFee({ ...params, networkId: 'btc--0' })).common
        .nativeTokenPrice,
    ).toBeUndefined();
    expect(mockGetNetwork).not.toHaveBeenCalled();
    expect(mockGetChainOnlyVault).not.toHaveBeenCalled();
  });
});
