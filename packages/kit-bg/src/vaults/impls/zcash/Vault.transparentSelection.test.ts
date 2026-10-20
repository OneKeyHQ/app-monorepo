/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import type { IZcashTransparentTxRequest } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import Vault from './Vault';

it.each([1, 3])(
  'allocates only prefixes needed for a quote succeeding at input count %s',
  async (required) => {
    const utxos = Array.from({ length: 4000 }, (_, index) => ({
      txid: index.toString(16).padStart(64, '0'),
      vout: 0,
      valueZat: '100000',
      scriptPubKey: `76a914${'00'.repeat(20)}88ac`,
      isCoinbase: false,
      confirmations: 10,
      derivationPath: "m/44'/133'/0'/0/0",
    }));
    // Sorting returns the same synthetic descending catalog so we can count
    // prefix allocations, independently of the quote implementation.
    jest.spyOn(utxos, 'toSorted').mockReturnValue(utxos);
    const slice = jest.spyOn(utxos, 'slice');
    const quote = jest.fn(async (request: IZcashTransparentTxRequest) => {
      expect(slice).toHaveBeenCalledTimes(request.selectedOutpoints.length);
      expect(request.utxos).toHaveLength(request.selectedOutpoints.length);
      if (request.selectedOutpoints.length < required)
        throw new OneKeyLocalError('insufficient');
      return {
        spentOutpoints: request.selectedOutpoints,
        feeZat: '10000',
        sendAmountZat: '1000',
      };
    });
    const vault = Object.create(Vault.prototype) as Vault;
    const prune = jest
      .spyOn(vault, 'zcashDropExpiredTransparentSends')
      .mockRejectedValue(new OneKeyLocalError('history expiry unavailable'));
    Object.assign(vault, {
      accountId: 'a',
      backgroundApi: {
        simpleDb: {
          zcash: {
            listTransparentPendingTxs: async () => [],
          },
        },
      },
      validateAddress: async () => ({ isValid: true }),
      zcashFetchFreshTransparentUtxos: async () => ({
        account: {},
        accountIndex: 0,
        targetHeight: 3_000_000,
        utxos,
      }),
      zcashTransparentChange: async () => ({
        address: 't1-change',
        derivationPath: "m/44'/133'/0'/1/0",
      }),
      zcashGetApi: async () => ({ quoteTransparentTx: quote }),
    });
    const result = await vault['zcashBuildTransparentEncodedTx']({
      transferInfo: {
        from: 't1-sender',
        to: 't1-recipient',
        amount: '0.00001',
      },
      sendMax: false,
    });
    expect(quote).toHaveBeenCalledTimes(required);
    expect(slice).toHaveBeenCalledTimes(required);
    expect(result.inputs).toHaveLength(required);
    expect(prune).not.toHaveBeenCalled();
    quote.mockImplementationOnce(async (request) => {
      expect(request.selectedOutpoints).toHaveLength(required);
      return {
        spentOutpoints: request.selectedOutpoints,
        feeZat: '10000',
        sendAmountZat: '1000',
      };
    });
    await vault.zcashPrepareFreshTransparentRequest({ encodedTx: result });
    expect(prune).not.toHaveBeenCalled();
  },
);
