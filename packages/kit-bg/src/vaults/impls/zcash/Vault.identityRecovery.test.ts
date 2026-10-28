/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');
jest.mock('../../../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { withMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

import { SimpleDbEntityPrivacyChainCache } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';
import { SimpleDbEntityPrivacyChainJournal } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';
import { SimpleDbEntityPrivacyChainKeys } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';
import { SimpleDbEntityPrivacyChainState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import { SimpleDbEntityPrivacyChainXmrSent } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainXmrSent';
import { SimpleDbEntityPrivacyChainZcashSent } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainZcashSent';
import ServicePrivacyChain from '../../../services/ServicePrivacyChain';
import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';
import { getLocalWalletViewingKey } from '../../localWallet/viewingKeyStore';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
import Vault from './Vault';
import { zcashIdentityMismatchAccountIds } from './vaultUtils';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBAccount } from '../../../dbs/local/types';

const networkId = 'zec--0';

// An account whose re-derived key no longer matches its identity is recovered by: turn off, delete local data, turn on.
describe('Zcash identity mismatch recovery', () => {
  it('turning off, deleting local data and turning on adopts the new key', async () => {
    const account = { id: 'hd-1--zcash', pathIndex: 0 } as IDBAccount;
    const privacyChainState = withMemoryStorage(
      new SimpleDbEntityPrivacyChainState(),
    );
    const purgeWallet = jest.fn(async () => ({ removed: true }));
    const backgroundApi = {
      simpleDb: {
        privacyChainState,
        privacyChainKeys: withMemoryStorage(
          new SimpleDbEntityPrivacyChainKeys(),
        ),
        privacyChainJournal: withMemoryStorage(
          new SimpleDbEntityPrivacyChainJournal(),
        ),
        privacyChainXmrSent: withMemoryStorage(
          new SimpleDbEntityPrivacyChainXmrSent(),
        ),
        privacyChainZcashSent: withMemoryStorage(
          new SimpleDbEntityPrivacyChainZcashSent(),
        ),
        privacyChainCache: withMemoryStorage(
          new SimpleDbEntityPrivacyChainCache(),
        ),
        localTokens: { removeAccountTokenList: jest.fn(async () => undefined) },
        accountValue: {
          removeAccountNetworkValue: jest.fn(async () => undefined),
        },
      },
      serviceAccount: {
        getDBAccountSafe: jest.fn(async () => account),
        getAccount: jest.fn(async () => ({ address: 't1account' })),
      },
    } as unknown as IBackgroundApi;
    const derived = {
      ufvk: 'ufvk-before-firmware-change',
      unifiedAddress: 'u1-synthetic',
      transparentAddress: 't1-synthetic',
      seedFingerprintHex: '00'.repeat(32),
      chainTip: 3_500_000,
    };
    const setUp = (ufvk: string) =>
      resolveAndSaveZcashAccountMeta({
        account,
        backgroundApi,
        networkId,
        derive: async () => ({ ...derived, ufvk }),
      });

    await privacyChainState.beginZcashPrivacyModeEnable({
      networkId,
      accountId: account.id,
      birthdayHeight: 3_000_000,
    });
    await setUp('ufvk-before-firmware-change');
    await privacyChainState.completeZcashPrivacyModeEnable({
      accountId: account.id,
    });

    await backgroundApi.simpleDb.privacyChainKeys.removeKeys({
      accountIds: [account.id],
    });
    const mismatch = await setUp('ufvk-after-firmware-change').catch(
      (e: unknown) => e,
    );
    expect((mismatch as Error).message).toBe(
      ETranslations.privacy_error_identity_mismatch__msg,
    );
    expect((mismatch as { autoToast?: boolean }).autoToast).toBe(true);
    expect(zcashIdentityMismatchAccountIds.has(account.id)).toBe(true);

    await privacyChainState.beginZcashPrivacyModeDisable({
      accountId: account.id,
      resumeFromHeight: 3_100_000,
    });
    await privacyChainState.completeZcashPrivacyModeDisable({
      accountId: account.id,
    });

    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId,
      backgroundApi,
      zcashResolveLightwalletdUrl: async () => 'https://zcash.example',
      zcashGetApi: async () => ({ purgeWallet }),
    });
    const capability = vault.getLocalWalletCapability();
    await expect(
      capability.getAccountState({ accountId: account.id }),
    ).resolves.toMatchObject({ identityMismatch: true });

    const service = Object.assign(
      Object.create(ServicePrivacyChain.prototype) as ServicePrivacyChain,
      {
        backgroundApi,
        backfillActiveByAccount: {},
        boostPausedByNetwork: {},
        foregroundBoostRequestedByNetwork: {},
        syncFailureBackoff: new Map(),
        orphanCleanupGeneration: new Map(),
      },
    );
    service.scheduleBackgroundSync = jest.fn();
    await service.runLocalWalletLifecycle({
      event: 'deleteLocalData',
      targets: [
        {
          scope: 'accounts',
          networkId,
          capability,
          accountIds: [account.id],
        },
      ],
    });
    // The lost key does not matter: the runtime account is named by the old identity.
    expect(purgeWallet).toHaveBeenCalledWith({
      network: 'main',
      label: getViewingKeyFingerprint({
        networkId,
        viewingKey: 'ufvk-before-firmware-change',
      }),
    });
    await expect(
      privacyChainState.hasRuntimeOrphans({ networkId }),
    ).resolves.toBe(false);
    expect(zcashIdentityMismatchAccountIds.has(account.id)).toBe(false);
    await expect(
      capability.getAccountState({ accountId: account.id }),
    ).resolves.not.toHaveProperty('identityMismatch');

    await privacyChainState.beginZcashPrivacyModeEnable({
      networkId,
      accountId: account.id,
      birthdayHeight: 3_000_000,
    });
    await setUp('ufvk-after-firmware-change');
    await privacyChainState.completeZcashPrivacyModeEnable({
      accountId: account.id,
    });

    const newVkFp = getViewingKeyFingerprint({
      networkId,
      viewingKey: 'ufvk-after-firmware-change',
    });
    await expect(
      privacyChainState.getZcashAccountMeta({ accountId: account.id }),
    ).resolves.toMatchObject({ vkFp: newVkFp, birthdayHeight: 3_000_000 });
    await expect(
      getLocalWalletViewingKey({
        backgroundApi,
        networkId,
        accountId: account.id,
      }),
    ).resolves.toEqual({ value: 'ufvk-after-firmware-change', vkFp: newVkFp });
    await expect(
      privacyChainState.isZcashPrivacyModeEnabled({ accountId: account.id }),
    ).resolves.toBe(true);
  });
});
