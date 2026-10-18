/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityZcash } from '../../../dbs/simple/entity/SimpleDbEntityZcash';

import Vault from './Vault';

it.each([false, true])(
  'applies an explicit birthday durably before enabling (purge interrupted: %s)',
  async (interrupt) => {
    const accountId = 'account';
    let saved: unknown = null;
    const entity = new SimpleDbEntityZcash();
    (entity as { appStorage: unknown }).appStorage = {
      getItem: async () => saved,
      setItem: async (_key: string, value: unknown) => {
        saved = value;
      },
    };
    await entity.beginPrivacyModeEnable({
      accountId,
      birthdayHeight: 2_000_000,
    });
    await entity.saveAccountMeta({
      accountId,
      meta: {
        ufvk: 'birthday-fixture',
        unifiedAddress: 'u1',
        transparentAddress: 't1',
        seedFingerprintHex: '00',
        hdIndex: 0,
        birthdayHeight: 2_000_000,
        createdAt: 1,
      },
    });
    await entity.completePrivacyModeEnable({ accountId });
    await entity.markPrivacyModeScanExcluded({
      accountId,
      fromHeight: 2_000_000,
    });
    await entity.beginPrivacyModeDisable({
      accountId,
      resumeFromHeight: 2_500_000,
    });
    await entity.completePrivacyModeDisable({ accountId });
    const birthdayTimestamp = Date.now() - 90 * 24 * 60 * 60 * 1000;
    await entity.beginPrivacyModeEnable({
      accountId,
      birthdayTimestamp,
      resetResumeFromHeight: true,
    });
    const requests: number[] = [];
    let registered = false;
    const purge = jest.fn(async () => {
      const [meta, pending] = await Promise.all([
        entity.getAccountMeta({ accountId }),
        entity.listPendingRescans(),
      ]);
      expect(meta?.birthdayTimestamp).toBe(birthdayTimestamp);
      expect(meta?.birthdayHeight).toBe(pending[0].repair.birthdayHeight);
      if (interrupt && purge.mock.calls.length === 1)
        throw new OneKeyLocalError('synthetic process interruption');
    });
    const vault = Object.create(Vault.prototype) as Vault;
    Object.assign(vault, {
      backgroundApi: {
        simpleDb: { zcash: entity },
        serviceAccount: { getDBAccountSafe: async () => ({ id: accountId }) },
      },
      listLocalWalletAccounts: async () => ({
        accounts: [{ accountId, runtimeKey: 'main', syncEnabled: false }],
      }),
      zcashGetAccountMeta: async () => entity.getAccountMeta({ accountId }),
      zcashGetWalletAccount: async () => ({
        ...(await entity.getAccountMeta({ accountId })),
        network: 'main',
      }),
      zcashGetApi: async () => ({ purgeWallet: purge }),
      getLocalWalletChainTip: async () => 3_000_000,
      zcashPrepareAccounts: async () => {
        registered = true;
        return [{ ufvk: 'birthday-fixture' }];
      },
      // The runtime refuses to requeue an account it has not registered.
      queueLocalWalletRescanFrom: async ({
        fromHeight,
      }: {
        fromHeight: number;
      }) => {
        if (!registered) {
          throw Object.assign(new OneKeyLocalError('not registered'), {
            code: 'ACCOUNT_NOT_FOUND',
          });
        }
        requests.push(fromHeight);
      },
    });
    const onPrepared = jest.fn(() =>
      entity.completePrivacyModeEnable({ accountId, maxEnabledAccounts: 5 }),
    );
    const first = vault.zcashPreparePrivacyModeAccount({
      accountId,
      fromHeight: 2_500_000,
      birthday: { type: 'timestamp', timestamp: birthdayTimestamp },
      onPrepared,
    });
    if (interrupt) {
      await expect(first).rejects.toThrow('synthetic process interruption');
      expect(await entity.listPendingRescans()).toHaveLength(1);
      await entity.cancelPendingPrivacyModeEnables({ accountId });
      const meta = await entity.getAccountMeta({ accountId });
      await entity.beginPrivacyModeEnable({
        accountId,
        birthdayHeight: meta?.birthdayHeight,
      });
      purge.mockImplementationOnce(async () => {
        throw new OneKeyLocalError('synthetic wallet busy');
      });
      await expect(
        vault.zcashPreparePrivacyModeAccount({
          accountId,
          fromHeight: meta?.birthdayHeight ?? 0,
          onPrepared,
        }),
      ).rejects.toThrow('synthetic wallet busy');
      expect(onPrepared).not.toHaveBeenCalled();
      expect((await entity.getPrivacyModeState({ accountId })).intent).toBe(
        'off',
      );
      expect(await entity.listPendingRescans()).toHaveLength(1);
      await vault.zcashPreparePrivacyModeAccount({
        accountId,
        fromHeight: meta?.birthdayHeight ?? 0,
        onPrepared,
      });
    } else {
      await first;
    }
    const meta = await entity.getAccountMeta({ accountId });
    expect(meta?.birthdayHeight).not.toBe(2_000_000);
    expect(requests).toEqual([meta?.birthdayHeight]);
    expect(await entity.listPendingRescans()).toEqual([]);
    expect(await entity.getPrivacyModeState({ accountId })).toMatchObject({
      intent: 'on',
      birthdayHeight: meta?.birthdayHeight,
      birthdayTimestamp,
    });
    expect(
      (await entity.getPrivacyModeState({ accountId })).resumeFromHeight,
    ).toBeUndefined();
    expect(
      (await entity.getPrivacyModeState({ accountId })).scanExcludedFromHeight,
    ).toBeUndefined();
  },
);
