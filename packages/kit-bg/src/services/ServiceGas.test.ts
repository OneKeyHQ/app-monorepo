import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';

import { vaultFactory } from '../vaults/factory';

import ServiceGas from './ServiceGas';

jest.mock('../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../vaults/impls/fil/utils', () => ({ FIL_MIN_BASE_FEE: 100 }));

describe('ServiceGas provider gas limits', () => {
  afterEach(() => jest.restoreAllMocks());
  const common = {
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeDecimals: 18,
    nativeSymbol: 'ETH',
    baseFee: '3',
  };
  const approvalFee = {
    gas: [{ gasPrice: '2', gasLimit: '50000' }],
    gasEIP1559: [],
  };
  const reset: IEncodedTxEvm = {
    from: '0xsender',
    to: '0xtoken',
    data: '0xreset',
    value: '0x0',
  };
  const approve: IEncodedTxEvm = { ...reset, data: '0xapprove' };
  const swap: IEncodedTxEvm = {
    from: '0xsender',
    to: '0xrouter',
    data: '0xswap',
    value: '0x1234',
  };

  it('keeps reset/approval simulation ordered and excludes the known swap from it', async () => {
    const service = Object.create(ServiceGas.prototype) as ServiceGas;
    service.backgroundApi = {
      serviceAccountProfile: { _getWalletTypeHeader: async () => ({}) },
    } as unknown as ServiceGas['backgroundApi'];
    const post = jest.fn().mockResolvedValue({
      data: { data: { ...common, result: [approvalFee, approvalFee] } },
    });
    service.getClient = jest
      .fn<
        ReturnType<ServiceGas['getClient']>,
        Parameters<ServiceGas['getClient']>
      >()
      .mockResolvedValue({ post } as unknown as Awaited<
        ReturnType<ServiceGas['getClient']>
      >);
    const known = jest.spyOn(service, 'estimateFee').mockResolvedValue({
      common: { ...common, baseFee: '9' },
      gas: [{ gasPrice: '2', gasLimit: '240972' }],
    } as Awaited<ReturnType<ServiceGas['estimateFee']>>);
    const result = await service.batchEstimateFee({
      networkId: 'evm--1',
      accountId: 'test',
      encodedTxs: [reset, approve, swap],
      gasLimits: [undefined, undefined, '240972'],
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toEqual({
      networkId: 'evm--1',
      encodedTxList: [reset, approve],
    });
    expect(known).toHaveBeenCalledWith(
      expect.objectContaining({
        encodedTx: swap,
        gasLimit: '240972',
        gasAccountEnabled: false,
      }),
    );
    expect(result.txFees.map((fee) => fee.gas[0].gasLimit)).toEqual([
      '50000',
      '50000',
      '240972',
    ]);
    expect(result.txFees.map((fee) => fee.baseFee)).toEqual(['3', '3', '9']);
  });

  it('preserves the full transaction for L1 fee calculation when provider gas is supplied', async () => {
    const service = Object.create(ServiceGas.prototype) as ServiceGas;
    const buildEstimateFeeParams = jest
      .fn()
      .mockResolvedValue({ encodedTx: { ...swap, value: '0x0' } });
    jest
      .spyOn(vaultFactory, 'getVault')
      .mockResolvedValue({ buildEstimateFeeParams } as unknown as Awaited<
        ReturnType<typeof vaultFactory.getVault>
      >);
    const result = await service.buildEstimateFeeParams({
      networkId: 'evm--1',
      accountId: 'test',
      encodedTx: swap,
      gasLimit: '240972',
    });
    expect(result.encodedTx).toBe(swap);
    expect(result.gasLimit).toBe('240972');
    expect(
      (
        await service.buildEstimateFeeParams({
          networkId: 'evm--1',
          accountId: 'test',
          encodedTx: swap,
        })
      ).encodedTx,
    ).toEqual({ ...swap, value: '0x0' });
  });
});
