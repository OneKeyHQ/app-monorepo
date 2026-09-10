import type {
  IZcashBalance,
  IZcashPoolDetail,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import {
  backgroundClass,
  backgroundMethod,
  backgroundMethodForDev,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_ZCASH } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { vaultFactory } from '../vaults/factory';
import {
  getZcashLifecycleMutex,
  getZcashPrivacyModeOperationMutex,
} from '../vaults/impls/zcash/lifecycle';

import ServiceBase from './ServiceBase';

import type { IZcashAccountMeta } from '../dbs/simple/entity/SimpleDbEntityZcash';
import type { VaultBaseChainOnly } from '../vaults/base/VaultBase';
import type VaultZcash from '../vaults/impls/zcash/Vault';
import type { ILocalWalletCapability } from '../vaults/localWallet/types';

export type IZcashLocalWalletAccountMeta = IZcashAccountMeta;
export type IZcashLocalWalletBalance = IZcashBalance;
export type IZcashLocalWalletPoolDetail = IZcashPoolDetail;

function requireLocalWalletCapability(
  vault: VaultBaseChainOnly,
): ILocalWalletCapability {
  const capability = vault.getLocalWalletCapability();
  if (!capability) {
    throw new OneKeyLocalError(
      `zcash: local wallet capability missing for ${vault.networkId}`,
    );
  }
  return capability;
}

function getResumeFromHeight({
  progress,
  birthdayHeight,
}: {
  progress: Awaited<ReturnType<ILocalWalletCapability['getSyncProgress']>>;
  birthdayHeight: number;
}): number {
  if (!progress?.isBackfillComplete) {
    return birthdayHeight;
  }
  const scannedHeight = progress.tipScannedHeight ?? progress.chainTip;
  if (scannedHeight === null) {
    return birthdayHeight;
  }
  return Math.max(birthdayHeight, scannedHeight - 100);
}

@backgroundClass()
class ServiceZcash extends ServiceBase {
  private async assertZcashAccountContext({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    const [network, account] = await Promise.all([
      this.backgroundApi.serviceNetwork.getNetworkSafe({ networkId }),
      this.backgroundApi.serviceAccount.getDBAccountSafe({ accountId }),
    ]);
    if (!network || network.impl !== IMPL_ZCASH) {
      throw new OneKeyLocalError(
        `zcash: network is not compatible with privacy mode: ${networkId}`,
      );
    }
    if (
      !account ||
      account.impl !== IMPL_ZCASH ||
      !accountUtils.isHdAccount({ accountId })
    ) {
      throw new OneKeyLocalError(
        'zcash: privacy mode is currently supported only for existing HD accounts',
      );
    }
  }

  @backgroundMethod()
  async getPrivacyModeState({ accountId }: { accountId: string }) {
    return this.backgroundApi.simpleDb.zcash.getPrivacyModeState({ accountId });
  }

  @backgroundMethod()
  async setPreferTransparentForShieldedSends({
    networkId,
    accountId,
    enabled,
  }: {
    networkId: string;
    accountId: string;
    enabled: boolean;
  }): Promise<void> {
    await this.assertZcashAccountContext({ networkId, accountId });
    await this.backgroundApi.simpleDb.zcash.setPreferTransparentForShieldedSends(
      { accountId, enabled },
    );
  }

  @backgroundMethod()
  async enablePrivacyMode(params: {
    networkId: string;
    accountId: string;
    birthdayHeight?: number;
    birthdayTimestamp?: number;
  }): Promise<void> {
    await getZcashPrivacyModeOperationMutex(params.accountId).runExclusive(() =>
      this.enablePrivacyModeImpl(params),
    );
  }

  private async enablePrivacyModeImpl({
    networkId,
    accountId,
    birthdayHeight,
    birthdayTimestamp,
  }: {
    networkId: string;
    accountId: string;
    birthdayHeight?: number;
    birthdayTimestamp?: number;
  }): Promise<void> {
    await this.assertZcashAccountContext({ networkId, accountId });
    const state = await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
      accountId,
    });
    if (state.intent === 'on' && state.operation === undefined) {
      const existingMeta =
        await this.backgroundApi.simpleDb.zcash.getAccountMeta({ accountId });
      if (existingMeta) {
        return;
      }
    }
    const selectedBirthdayHeight = birthdayHeight ?? state.birthdayHeight;
    const selectedBirthdayTimestamp =
      birthdayTimestamp ??
      state.birthdayTimestamp ??
      state.birthdayMonthHint?.timestamp;
    if (
      selectedBirthdayHeight === undefined &&
      selectedBirthdayTimestamp === undefined
    ) {
      throw new OneKeyLocalError(
        'zcash: select a privacy recovery month before enabling',
      );
    }
    // Software accounts derive viewing keys from the seed (password); hardware
    // accounts ask the device for them.
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    const isHwWallet = accountUtils.isHwWallet({ walletId });
    let password: string | undefined;
    let deviceParams: IDeviceSharedCallParams | undefined;
    if (isHwWallet) {
      deviceParams =
        await this.backgroundApi.serviceAccount.getWalletDeviceParams({
          walletId,
          hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
        });
    } else {
      ({ password } =
        await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
          accountId,
          reason: EReasonForNeedPassword.CreateTransaction,
        }));
    }
    await this.backgroundApi.simpleDb.zcash.beginPrivacyModeEnable({
      accountId,
      birthdayHeight: selectedBirthdayHeight,
      birthdayTimestamp:
        selectedBirthdayHeight === undefined
          ? selectedBirthdayTimestamp
          : undefined,
    });

    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as VaultZcash;
    if (isHwWallet) {
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        () => vault.zcashRetryLocalWalletSetup({ deviceParams }),
        { deviceParams, debugMethodName: 'serviceZcash.enablePrivacyMode' },
      );
    } else {
      await vault.zcashRetryLocalWalletSetup({ password });
    }
    const capability = requireLocalWalletCapability(vault);
    const meta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId,
    });
    if (!meta) {
      throw new OneKeyLocalError(
        'zcash: viewing metadata was not persisted during privacy setup',
      );
    }

    const enableFromHeight =
      state.resumeFromHeight ?? meta.birthdayHeight ?? selectedBirthdayHeight;
    if (enableFromHeight === undefined) {
      throw new OneKeyLocalError(
        'zcash: privacy birthday was not resolved during setup',
      );
    }
    const result = await capability.syncGroup({
      accountIds: [accountId],
      rescanFrom: { accountId, fromHeight: enableFromHeight },
      chainTip: await capability.getChainTip(),
    });
    if (!result.synced) {
      throw new OneKeyLocalError(
        'zcash: privacy runtime registration did not complete',
      );
    }
    await this.backgroundApi.simpleDb.zcash.completePrivacyModeEnable({
      accountId,
    });
    await this.backgroundApi.servicePrivacyChain.onLocalWalletAccountsChanged({
      networkId,
      accountIds: [accountId],
      backfillActive: !!result.backfillRemaining,
    });
  }

  @backgroundMethod()
  async disablePrivacyMode(params: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    await getZcashPrivacyModeOperationMutex(params.accountId).runExclusive(() =>
      this.disablePrivacyModeImpl(params),
    );
  }

  private async disablePrivacyModeImpl({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    await this.assertZcashAccountContext({ networkId, accountId });
    const meta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId,
    });
    const lifecycleMutex = getZcashLifecycleMutex(meta?.ufvk ?? accountId);
    await lifecycleMutex.runExclusive(async () => {
      const state = await this.backgroundApi.simpleDb.zcash.getPrivacyModeState(
        {
          accountId,
        },
      );
      if (state.intent !== 'on' || state.operation !== undefined) {
        await this.backgroundApi.simpleDb.zcash.completePrivacyModeDisable({
          accountId,
        });
        return;
      }
      const vault = (await vaultFactory.getChainOnlyVault({
        networkId,
      })) as VaultZcash;
      const capability = requireLocalWalletCapability(vault);
      await vault.zcashAssertNoUnresolvedBroadcast(accountId);
      const progress = await capability.getSyncProgress({ accountId });
      const birthdayHeight =
        state.birthdayHeight ?? progress?.birthdayHeight ?? undefined;
      if (birthdayHeight === undefined) {
        throw new OneKeyLocalError(
          'zcash: privacy birthday is missing while disabling',
        );
      }
      await this.backgroundApi.simpleDb.zcash.beginPrivacyModeDisable({
        accountId,
        resumeFromHeight: getResumeFromHeight({
          progress,
          birthdayHeight,
        }),
      });
      await this.backgroundApi.simpleDb.zcash.completePrivacyModeDisable({
        accountId,
      });
    });
    await this.backgroundApi.servicePrivacyChain.onLocalWalletAccountsChanged({
      networkId,
      accountIds: [accountId],
      backfillActive: false,
    });
  }

  @backgroundMethod()
  async deleteLocalPrivacyData({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    await this.assertZcashAccountContext({ networkId, accountId });
    await getZcashPrivacyModeOperationMutex(accountId).runExclusive(
      async () => {
        const state =
          await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
            accountId,
          });
        if (state.intent === 'on' && state.operation === undefined) {
          await this.disablePrivacyModeImpl({ networkId, accountId });
        }
        const vault = (await vaultFactory.getChainOnlyVault({
          networkId,
        })) as VaultZcash;
        await vault.deleteLocalPrivacyData({
          accountId,
        });
      },
    );
    await this.backgroundApi.servicePrivacyChain.onLocalWalletAccountsChanged({
      networkId,
      accountIds: [accountId],
      backfillActive: false,
    });
  }

  // Not a background method: the UI never receives the viewing key. In-process
  // callers (the vault capability) use it for addresses and birthday fields.
  async getLocalWalletAccountMeta({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<IZcashAccountMeta | undefined> {
    await this.assertZcashAccountContext({ networkId, accountId });
    return getZcashPrivacyModeOperationMutex(accountId).runExclusive(
      async () => {
        const privacyModeEnabled =
          await this.backgroundApi.simpleDb.zcash.isPrivacyModeEnabled({
            accountId,
          });
        if (!privacyModeEnabled) {
          return undefined;
        }
        const vault = (await vaultFactory.getChainOnlyVault({
          networkId,
        })) as VaultZcash;
        return vault.getLocalWalletAccountMeta({ accountId });
      },
    );
  }

  // Developer diagnostics only: the viewing key must not be reachable from
  // the UI runtime through an ordinary background method.
  @backgroundMethodForDev()
  async getLocalWalletAccountMetaForDebug(params: {
    $$devOnlyPassword: string;
    networkId: string;
    accountId: string;
  }): Promise<IZcashAccountMeta | undefined> {
    return this.getLocalWalletAccountMeta({
      networkId: params.networkId,
      accountId: params.accountId,
    });
  }

  @backgroundMethod()
  async getLocalWalletBalance({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<IZcashBalance | null> {
    await this.assertZcashAccountContext({ networkId, accountId });
    return getZcashPrivacyModeOperationMutex(accountId).runExclusive(
      async () => {
        const privacyModeEnabled =
          await this.backgroundApi.simpleDb.zcash.isPrivacyModeEnabled({
            accountId,
          });
        if (!privacyModeEnabled) {
          return null;
        }
        const vault = (await vaultFactory.getChainOnlyVault({
          networkId,
        })) as VaultZcash;
        return vault.getLocalWalletBalance({ accountId });
      },
    );
  }

  @backgroundMethod()
  async retryLocalWalletSetup(params: {
    networkId: string;
    accountId: string;
  }): Promise<void> {
    await this.enablePrivacyMode(params);
  }
}

export default ServiceZcash;
