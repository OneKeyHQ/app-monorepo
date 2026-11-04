/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance');
// The node's block-time search places a date at this height.
jest.mock('./birthday', () => ({
  ...jest.requireActual<typeof import('./birthday')>('./birthday'),
  placeZcashBirthdayHeight: jest.fn(async () => 3_650_000),
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { createUntrackedMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

import { SimpleDbEntityPrivacyChainState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';

import Vault from './Vault';

it.each([false, true])(
  'applies an explicit birthday durably before enabling (rescan interrupted: %s)',
  async (interrupt) => {
    const accountId = 'account';
    const networkId = 'zec--0';
    const storage = createUntrackedMemoryStorage(null);
    const entity = new SimpleDbEntityPrivacyChainState();
    (entity as { appStorage: unknown }).appStorage = {
      getItem: storage.getItem,
      setItem: storage.setItem,
    };
    await entity.beginZcashPrivacyModeEnable({
      networkId,
      accountId,
      birthdayHeight: 3_500_000,
    });
    await entity.saveZcashAccountMeta({
      accountId,
      meta: {
        vkFp: 'a'.repeat(32),
        unifiedAddress: 'u1',
        transparentAddress: 't1',
        seedFingerprintHex: '00'.repeat(32),
        hdIndex: 0,
        birthdayHeight: 3_500_000,
        createdAt: 1,
      },
    });
    await entity.completeZcashPrivacyModeEnable({ accountId });
    await entity.markZcashScanExcluded({
      accountId,
      fromHeight: 3_500_000,
    });
    await entity.beginZcashPrivacyModeDisable({
      accountId,
      resumeFromHeight: 3_600_000,
    });
    await entity.completeZcashPrivacyModeDisable({ accountId });
    const birthdayTimestamp = Date.now() - 90 * 24 * 60 * 60 * 1000;
    await entity.beginZcashPrivacyModeEnable({
      networkId,
      accountId,
      birthdayTimestamp,
      resetResumeFromHeight: true,
    });
    const requests: number[] = [];
    let retryFromHeight: number | undefined;
    let registered = false;
    const purge = jest.fn(async (account: { birthdayHeight?: number }) => {
      const [meta, pending] = await Promise.all([
        entity.getZcashAccountMeta({ accountId }),
        entity.listZcashPendingRescans({ networkId }),
      ]);
      // The journal keeps the date; the runtime moves to the node's height.
      expect(pending[0].repair.birthdayHeightEstimated).toBe(true);
      expect(account.birthdayHeight).toBe(3_650_000);
      expect(meta?.birthdayHeight).toBe(3_500_000);
      if (interrupt && purge.mock.calls.length === 1)
        throw new OneKeyLocalError('synthetic process interruption');
    });
    const vault = Object.create(Vault.prototype) as Vault;
    Object.assign(vault, {
      networkId,
      backgroundApi: {
        simpleDb: { privacyChainState: entity },
        serviceAccount: { getDBAccountSafe: async () => ({ id: accountId }) },
      },
      listLocalWalletAccounts: async () => ({
        accounts: [{ accountId, runtimeKey: 'main', syncEnabled: false }],
      }),
      zcashGetAccountMeta: async () =>
        entity.getZcashAccountMeta({ accountId }),
      zcashGetWalletAccount: async () => ({
        ...(await entity.getZcashAccountMeta({ accountId })),
        network: 'main',
      }),
      zcashGetApi: async () => ({ rescanWallet: purge }),
      getLocalWalletChainTip: async () => 3_700_000,
      zcashResolveLightwalletdUrl: async () => 'https://lightwalletd.test',
      zcashPrepareAccounts: async () => {
        registered = true;
        return [{ accountId, account: { ufvk: 'birthday-fixture' } }];
      },
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
      entity.completeZcashPrivacyModeEnable({ accountId }),
    );
    const first = vault.zcashPreparePrivacyModeAccount({
      accountId,
      fromHeight: 3_600_000,
      birthday: { type: 'timestamp', timestamp: birthdayTimestamp },
      onPrepared,
    });
    if (interrupt) {
      await expect(first).rejects.toThrow('synthetic process interruption');
      expect(await entity.listZcashPendingRescans({ networkId })).toHaveLength(
        1,
      );
      await entity.cancelZcashPendingEnables({ networkId, accountId });
      const [{ repair }] = await entity.listZcashPendingRescans({ networkId });
      retryFromHeight = repair.birthdayHeight;
      await entity.beginZcashPrivacyModeEnable({
        networkId,
        accountId,
        birthdayHeight: repair.birthdayHeight,
      });
      purge.mockImplementationOnce(async () => {
        throw new OneKeyLocalError('synthetic wallet busy');
      });
      await expect(
        vault.zcashPreparePrivacyModeAccount({
          accountId,
          fromHeight: repair.birthdayHeight,
          onPrepared,
        }),
      ).rejects.toThrow('synthetic wallet busy');
      expect(onPrepared).not.toHaveBeenCalled();
      expect(
        (await entity.getZcashPrivacyModeState({ accountId })).intent,
      ).toBe('off');
      expect(await entity.listZcashPendingRescans({ networkId })).toHaveLength(
        1,
      );
      await vault.zcashPreparePrivacyModeAccount({
        accountId,
        fromHeight: repair.birthdayHeight,
        onPrepared,
      });
    } else {
      await first;
    }
    const meta = await entity.getZcashAccountMeta({ accountId });
    expect(meta?.birthdayHeight).toBe(3_650_000);
    expect(meta?.birthdayHeightEstimated).toBeUndefined();
    // A retry queues the start its caller read from the journal.
    expect(requests).toEqual([retryFromHeight ?? meta?.birthdayHeight]);
    expect(await entity.listZcashPendingRescans({ networkId })).toEqual([]);
    expect(await entity.getZcashPrivacyModeState({ accountId })).toMatchObject({
      intent: 'on',
      birthdayHeight: meta?.birthdayHeight,
      birthdayTimestamp,
    });
    expect(
      (await entity.getZcashPrivacyModeState({ accountId })).resumeFromHeight,
    ).toBeUndefined();
    expect(
      (await entity.getZcashPrivacyModeState({ accountId }))
        .scanExcludedFromHeight,
    ).toBeUndefined();
  },
);
