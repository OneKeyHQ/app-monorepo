import type { IZcashSendResult } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getZcashLifecycleMutex } from './lifecycle';
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
    const releasePczt = jest.fn(async () => undefined);
    const removeShieldedReservation = jest.fn(async () => undefined);
    const account = { ufvk: 'uview-submit-test' };
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: 'acc',
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          zcash: {
            isPrivacyModeEnabled: async () => true,
            listShieldedReservations: async () => [{ reservationId: 'r1' }],
            removeShieldedReservation,
          },
        },
      },
      zcashGetWalletAccount: async () => account,
      zcashGetApi: async () => ({ submitPczt, releasePczt }),
    });
    const params = {
      signedTx: {
        txid: '',
        rawTx: 'signed-pczt',
        encodedTx: {
          zcashMode: 'privacy',
          signedPcztHex: 'signed-pczt',
          pcztReservationId: 'r1',
        },
      },
    };
    return {
      vault,
      submitPczt,
      releasePczt,
      removeShieldedReservation,
      params,
    };
  }

  it('reports a rejection with the node reason and drops the host reservation', async () => {
    const { vault, releasePczt, removeShieldedReservation, params } =
      createVault({
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
    // The durable runtime record owns the notes until chain expiry.
    expect(releasePczt).not.toHaveBeenCalled();
    expect(removeShieldedReservation).toHaveBeenCalledWith({
      accountId: 'acc',
      reservationId: 'r1',
    });
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
      { pcztHex: 'signed-pczt', reservationId: 'r1' },
    );
  });

  it('keeps an accepted result when cleaning the host reservation fails', async () => {
    const { vault, params, removeShieldedReservation } = createVault({
      txid: 'tx1',
      broadcastState: 'accepted',
    });
    removeShieldedReservation.mockRejectedValueOnce(
      new Error('synthetic disk failure'),
    );
    await expect(
      vault.broadcastTransaction(params as never),
    ).resolves.toMatchObject({ txid: 'tx1' });
  });

  // Recorded for reconciliation; an unknown response is not acceptance.
  it('retains an unknown outcome explicitly for reconciliation', async () => {
    const { vault, params, removeShieldedReservation } = createVault({
      txid: 'tx1',
      broadcastState: 'unknown',
      broadcastError: { code: 'NETWORK_ERROR', params: {} },
    });

    await expect(
      vault.broadcastTransaction(params as never),
    ).resolves.toMatchObject({ txid: 'tx1', broadcastOutcomeUnknown: true });
    // The host record is the only trace a database rebuild cannot erase; it
    // stays until the transaction expires.
    expect(removeShieldedReservation).not.toHaveBeenCalled();
  });

  // Failed before anything reached the network: the notes are freed at once.
  it('frees the notes when the runtime fails before broadcasting', async () => {
    const { vault, releasePczt, removeShieldedReservation, params } =
      createVault(
        Object.assign(new Error('PCZT_ERROR'), {
          code: 'PCZT_ERROR',
          params: { stage: 'parse' },
        }),
      );

    await expect(vault.broadcastTransaction(params as never)).rejects.toThrow(
      ETranslations.privacy_error_build_failed__msg,
    );
    expect(releasePczt).toHaveBeenCalledWith(
      { ufvk: 'uview-submit-test' },
      { reservationId: 'r1' },
    );
    expect(removeShieldedReservation).toHaveBeenCalled();
  });

  // The carrier died mid-call: the runtime may have broadcast and recorded it.
  it('keeps the notes held when the outcome did not come back', async () => {
    const { vault, releasePczt, removeShieldedReservation, params } =
      createVault(new Error('WebEmbed bridge call timeout (360s)'));

    await expect(
      vault.broadcastTransaction(params as never),
    ).rejects.toMatchObject({ code: 'FINALIZE_OUTCOME_UNKNOWN' });
    expect(releasePczt).not.toHaveBeenCalled();
    expect(removeShieldedReservation).not.toHaveBeenCalled();
  });
});

// Leaving the review page without sending hands the PCZT's notes back; a
// signed reservation is kept by zcashAbandonPczt itself.
describe('Zcash review page closed without sending', () => {
  function createVault() {
    const zcashAbandonPczt = jest.fn(async () => undefined);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: 'acc',
      backgroundApi: {
        simpleDb: { zcash: { getAccountMeta: async () => undefined } },
      },
      zcashAbandonPczt,
    });
    return { vault, zcashAbandonPczt };
  }

  it('releases the reservation the build took', async () => {
    const { vault, zcashAbandonPczt } = createVault();
    await vault.releaseUnsignedTx({
      unsignedTx: { encodedTx: { pcztReservationId: 'r1' } } as never,
    });
    expect(zcashAbandonPczt).toHaveBeenCalledWith({
      accountId: 'acc',
      reservationId: 'r1',
    });
  });

  it('does nothing for a transparent send', async () => {
    const { vault, zcashAbandonPczt } = createVault();
    await vault.releaseUnsignedTx({
      unsignedTx: { encodedTx: { zcashMode: 'transparent' } } as never,
    });
    expect(zcashAbandonPczt).not.toHaveBeenCalled();
  });

  it('queues review cancellation until signing holds the reservation safely', async () => {
    let finishSigning: () => void = () => undefined;
    const pause = new Promise<void>((resolve) => {
      finishSigning = resolve;
    });
    const { vault, zcashAbandonPczt } = createVault();
    Reflect.set(vault, 'backgroundApi', {
      simpleDb: {
        zcash: {
          getAccountMeta: async () => ({ ufvk: 'cancel-during-signing' }),
        },
      },
    });
    const signing = getZcashLifecycleMutex(
      'cancel-during-signing',
    ).runExclusive(async () => {
      await pause;
    });
    const cancelling = vault.releaseUnsignedTx({
      unsignedTx: { encodedTx: { pcztReservationId: 'r1' } } as never,
    });
    await Promise.resolve();
    expect(zcashAbandonPczt).not.toHaveBeenCalled();
    finishSigning();
    await signing;
    await cancelling;
    expect(zcashAbandonPczt).toHaveBeenCalledTimes(1);
  });
});

describe('Zcash reservations left by an earlier run', () => {
  it('releases only unsigned reservations from before this process', async () => {
    const zcashAbandonPczt = jest.fn(async () => undefined);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      zcashAbandonPczt,
      backgroundApi: {
        simpleDb: {
          zcash: {
            listAccountIds: async () => ['acc'],
            listShieldedReservations: async () => [
              {
                reservationId: 'old-unsigned',
                state: 'unsigned',
                createdAt: 1,
              },
              { reservationId: 'old-signed', state: 'signed', createdAt: 1 },
              {
                reservationId: 'this-run',
                state: 'unsigned',
                createdAt: Date.now() + 60_000,
              },
            ],
            cancelPendingPrivacyModeEnables: async () => undefined,
            listPendingPrivacyModeDisables: async () => [],
          },
        },
      },
    });

    await vault.resumePendingPrivacyOperations();

    expect(zcashAbandonPczt.mock.calls).toEqual([
      [{ accountId: 'acc', reservationId: 'old-unsigned' }],
    ]);
  });
});
