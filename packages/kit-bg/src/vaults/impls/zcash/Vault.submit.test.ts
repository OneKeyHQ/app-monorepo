import type { IZcashSendResult } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { setLocalWalletRemoteConfigs } from '../../localWallet/remoteConfig';

import { getZcashAccountLifecycleMutex } from './lifecycle';
import Vault from './Vault';

jest.mock('../../../dbs/local/localDbInstance');

describe('Zcash private send submission', () => {
  afterEach(() => setLocalWalletRemoteConfigs({}));

  function createVault(result: IZcashSendResult | Error) {
    const submitPczt = jest.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    });
    const ensureLoaded = jest.fn(async () => undefined);
    const account = { ufvk: 'uview-submit-test' };
    const getWalletAccount = jest.fn(async () => account);
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: 'acc',
      networkId: 'zec--0',
      backgroundApi: {
        serviceCustomRpc: { ensureLocalWalletRemoteConfigLoaded: ensureLoaded },
        simpleDb: {
          privacyChainState: {
            isZcashPrivacyModeEnabled: async () => true,
          },
        },
      },
      zcashGetWalletAccount: getWalletAccount,
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
      account,
      getWalletAccount,
      ensureLoaded,
    };
  }

  it('refuses an old confirmation while the server disables privacy', async () => {
    const { vault, submitPczt, params } = createVault({
      txid: 'tx1',
      broadcastState: 'accepted',
    });
    setLocalWalletRemoteConfigs({ 'zec--0': { privacyDisabled: true } });
    await expect(vault.broadcastTransaction(params as never)).rejects.toThrow(
      ETranslations.global_not_available,
    );
    expect(submitPczt).not.toHaveBeenCalled();

    setLocalWalletRemoteConfigs({});
    await expect(
      vault.broadcastTransaction(params as never),
    ).resolves.toMatchObject({ txid: 'tx1' });
  });

  it('loads the persisted disable before submitting on a cold start', async () => {
    const { vault, submitPczt, params, ensureLoaded } = createVault({
      txid: 'tx1',
      broadcastState: 'accepted',
    });
    ensureLoaded.mockImplementation(async () => {
      setLocalWalletRemoteConfigs({ 'zec--0': { privacyDisabled: true } });
    });
    await expect(vault.broadcastTransaction(params as never)).rejects.toThrow(
      ETranslations.global_not_available,
    );
    expect(submitPczt).not.toHaveBeenCalled();
  });

  it('rechecks a server disable after waiting for the lifecycle lock', async () => {
    const { vault, submitPczt, params, account, getWalletAccount } =
      createVault({
        txid: 'tx1',
        broadcastState: 'accepted',
      });
    const mutex = getZcashAccountLifecycleMutex({
      networkId: vault.networkId,
      ufvk: account.ufvk,
    });
    const release = await mutex.acquire();
    let notifyReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      notifyReady = resolve;
    });
    getWalletAccount.mockImplementation(async () => {
      notifyReady();
      return account;
    });
    const pending = vault.broadcastTransaction(params as never);
    await ready;
    setLocalWalletRemoteConfigs({ 'zec--0': { privacyDisabled: true } });
    release();
    await expect(pending).rejects.toThrow(ETranslations.global_not_available);
    expect(submitPczt).not.toHaveBeenCalled();
  });

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

  // Not "node unreachable": that would send the user to resend elsewhere.
  it.each([{ code: 'NETWORK_ERROR', params: {} }, undefined])(
    'reports an uncertain broadcast as of unknown outcome (%o)',
    async (broadcastError) => {
      const { vault, params } = createVault({
        txid: 'tx1',
        broadcastState: 'unknown',
        broadcastError,
      });

      await expect(
        vault.broadcastTransaction(params as never),
      ).rejects.toMatchObject({ code: 'BROADCAST_OUTCOME_UNKNOWN' });
    },
  );

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

  it('propagates a carrier timeout without manufacturing a successful result', async () => {
    const error = new Error('WebEmbed bridge call timeout (360s)');
    const { vault, submitPczt, params } = createVault(error);

    await expect(vault.broadcastTransaction(params as never)).rejects.toBe(
      error,
    );
    expect(submitPczt).toHaveBeenCalledTimes(1);
  });
});
