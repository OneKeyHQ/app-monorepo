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
jest.mock('../states/jotai/atoms/settings', () => ({
  settingsPersistAtom: { get: async () => ({}) },
}));
jest.mock('../vaults/impls/fil/utils', () => ({ FIL_MIN_BASE_FEE: '0' }));
jest.mock('../vaults/localWallet/isLocalWalletNetwork', () => ({
  isLocalWalletNetwork: async () => true,
}));
const mockEstimateFee = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: async () => ({ estimateFee: mockEstimateFee }) },
}));
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IEstimateGasParams } from '@onekeyhq/shared/types/fee';

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
});
