/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  const passthrough =
    () => (_target: unknown, _key?: string, descriptor?: PropertyDescriptor) =>
      descriptor;
  return {
    ...actual,
    backgroundClass: passthrough,
    backgroundMethod: passthrough,
  };
});
jest.mock('../../../states/jotai/atoms', () => ({
  privacyChainAtom: { set: jest.fn(async () => undefined) },
}));

import { ETranslationsMock } from '@onekeyhq/shared/src/locale';

import { SimpleDbEntityPrivacyChainCache } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainCache';
import { SimpleDbEntityPrivacyChainJournal } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';
import { SimpleDbEntityPrivacyChainKeys } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainKeys';
import { SimpleDbEntityPrivacyChainState } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import { SimpleDbEntityPrivacyChainXmrSent } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainXmrSent';
import ServicePrivacyChain from '../../../services/ServicePrivacyChain';
import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';
import { getLocalWalletViewingKey } from '../../localWallet/viewingKeyStore';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
import Vault from './Vault';
import { zcashIdentityMismatchAccountIds } from './vaultUtils';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBAccount } from '../../../dbs/local/types';

const networkId = 'zec--0';

function withMemoryStorage<T extends object>(entity: T): T {
  let saved: unknown = null;
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
  return entity;
}

// RV-a1a4 P2-3 / RV-a5 P2-1: an account whose re-derived key no longer
// matches its identity (a firmware or encoding change) must be recoverable
// by the path the error names: turn off, delete local data, turn on.
describe('Zcash identity mismatch recovery', () => {
  it('turning off, deleting local data and turning on adopts the new key', async () => {
    const account = { id: 'hd-1--zcash', pathIndex: 0 } as IDBAccount;
    const privacyChainState = withMemoryStorage(
      new SimpleDbEntityPrivacyChainState(),
    );
    const purgeWallet = jest.fn(async () => undefined);
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

    // Enabled with the old key.
    await privacyChainState.beginZcashPrivacyModeEnable({
      networkId,
      accountId: account.id,
      birthdayHeight: 3_000_000,
    });
    await setUp('ufvk-before-firmware-change');
    await privacyChainState.completeZcashPrivacyModeEnable({
      accountId: account.id,
    });

    // The stored key is lost and the device now exports another one.
    await backgroundApi.simpleDb.privacyChainKeys.removeKeys({
      accountIds: [account.id],
    });
    const mismatch = await setUp('ufvk-after-firmware-change').catch(
      (e: unknown) => e,
    );
    expect((mismatch as Error).message).toBe(
      ETranslationsMock.privacy_error_identity_mismatch__msg,
    );
    // Retry and Enable only log what they catch; the toast is the message.
    expect((mismatch as { autoToast?: boolean }).autoToast).toBe(true);
    expect(zcashIdentityMismatchAccountIds.has(account.id)).toBe(true);

    // Off, as the switch does it.
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
    // The account row offers Delete instead of Retry.
    await expect(
      capability.getAccountState({ accountId: account.id }),
    ).resolves.toMatchObject({ identityMismatch: true });

    // Delete local data through the one executor and the real Zcash
    // primitives.
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
    // No key named the old runtime account, so the network is marked.
    expect(purgeWallet).not.toHaveBeenCalled();
    await expect(
      privacyChainState.hasRuntimeOrphans({ networkId }),
    ).resolves.toBe(true);
    expect(zcashIdentityMismatchAccountIds.has(account.id)).toBe(false);
    await expect(
      capability.getAccountState({ accountId: account.id }),
    ).resolves.not.toHaveProperty('identityMismatch');

    // On again: the new key is adopted, and the month is kept.
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
