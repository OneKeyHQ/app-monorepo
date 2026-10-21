import type { IZcashSendResult } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import Vault from './Vault';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// The runtime stores the authorized transaction before broadcasting. Definitive
// rejection remains recorded; ambiguous outcomes retain the same transaction.
describe('Zcash private send submission', () => {
  function createVault(result: IZcashSendResult | Error) {
    const submitPczt = jest.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    });
    const account = { ufvk: 'uview-submit-test' };
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: 'acc',
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          privacyChainState: {
            isZcashPrivacyModeEnabled: async () => true,
          },
        },
      },
      zcashGetWalletAccount: async () => account,
      zcashGetApi: async () => ({ submitPczt }),
    });
    const params = {
      signedTx: {
        txid: '',
        rawTx: 'signed-pczt',
        encodedTx: {
          zcashMode: 'privacy',
          signedPcztHex: 'signed-pczt',
        },
      },
    };
    return {
      vault,
      submitPczt,
      params,
    };
  }

  it('reports a rejection with the node reason', async () => {
    const { vault, params } = createVault({
      txid: 'tx1',
      broadcastState: 'rejected',
      broadcastError: {
        code: 'BROADCAST_REJECTED',
        params: {},
        detail: 'bad-txns-expired',
      },
    });

    await expect(vault.broadcastTransaction(params as never)).rejects.toThrow(
      'bad-txns-expired',
    );
  });

  it('returns the txid of an accepted send', async () => {
    const { vault, submitPczt, params } = createVault({
      txid: 'tx1',
      broadcastState: 'accepted',
    });

    await expect(
      vault.broadcastTransaction(params as never),
    ).resolves.toMatchObject({ txid: 'tx1' });
    expect(submitPczt).toHaveBeenCalledWith(
      { ufvk: 'uview-submit-test' },
      { pcztHex: 'signed-pczt' },
    );
  });

  // Recorded for reconciliation; an unknown response is not acceptance.
  it('retains an unknown outcome explicitly for reconciliation', async () => {
    const { vault, params } = createVault({
      txid: 'tx1',
      broadcastState: 'unknown',
      broadcastError: { code: 'NETWORK_ERROR', params: {} },
    });

    await expect(
      vault.broadcastTransaction(params as never),
    ).resolves.toMatchObject({ txid: 'tx1', broadcastOutcomeUnknown: true });
  });

  it('reports a runtime failure before the node is contacted', async () => {
    const { vault, params } = createVault(
      Object.assign(new Error('PCZT_ERROR'), {
        code: 'PCZT_ERROR',
        params: { stage: 'parse' },
      }),
    );

    await expect(vault.broadcastTransaction(params as never)).rejects.toThrow(
      ETranslations.privacy_error_build_failed__msg,
    );
  });

  // The carrier died mid-call: the runtime may have broadcast and recorded it.
  it('keeps the notes held when the outcome did not come back', async () => {
    const { vault, params } = createVault(
      new Error('WebEmbed bridge call timeout (360s)'),
    );

    await expect(
      vault.broadcastTransaction(params as never),
    ).rejects.toMatchObject({ code: 'FINALIZE_OUTCOME_UNKNOWN' });
  });
});
