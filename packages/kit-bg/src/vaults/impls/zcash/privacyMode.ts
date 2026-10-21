import { IMPL_ZCASH } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';
import { EHardwareCallContext } from '@onekeyhq/shared/types/device';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { getPrivacyModeResumeFromHeight } from '../../../services/PrivacyModeState';
import { vaultFactory } from '../../factory';
import { getVaultSettings } from '../../settings';

import { hasZcashAccountViewingKey } from './accountMeta';
import {
  getZcashLifecycleMutex,
  getZcashPrivacyModeOperationMutex,
} from './lifecycle';

import type VaultZcash from './Vault';
import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IZcashAccountMeta } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainState';
import type { VaultBaseChainOnly } from '../../base/VaultBase';
import type { ILocalWalletCapability } from '../../localWallet/types';
import type { IRescanLocalWalletFrom } from '../../types';

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

// Zcash's per-account Privacy Mode lifecycle behind the local-wallet
// capability: enable, disable and the viewing metadata they settle. The
// operation journal lives in simpleDb.privacyChainState.
export class ZcashPrivacyMode {
  private readonly backgroundApi: IBackgroundApi;

  constructor(backgroundApi: IBackgroundApi) {
    this.backgroundApi = backgroundApi;
  }

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
      (!accountUtils.isHdAccount({ accountId }) &&
        !accountUtils.isHwAccount({ accountId }))
    ) {
      throw new OneKeyLocalError(
        'zcash: privacy mode requires an existing HD or hardware account',
      );
    }
  }

  async getPrivacyModeState({ accountId }: { accountId: string }) {
    return this.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
      { accountId },
    );
  }

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
    const hasExplicitBirthday =
      birthdayHeight !== undefined || birthdayTimestamp !== undefined;
    const state =
      await this.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
        {
          accountId,
        },
      );
    if (
      !hasExplicitBirthday &&
      state.intent === 'on' &&
      state.operation === undefined
    ) {
      const existingMeta =
        await this.backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta(
          { accountId },
        );
      if (
        existingMeta &&
        (await hasZcashAccountViewingKey({
          backgroundApi: this.backgroundApi,
          networkId,
          accountId,
          vkFp: existingMeta.vkFp,
        }))
      ) {
        return;
      }
    }
    const selectedBirthdayHeight = hasExplicitBirthday
      ? birthdayHeight
      : state.birthdayHeight;
    const selectedBirthdayTimestamp = hasExplicitBirthday
      ? birthdayTimestamp
      : (state.birthdayTimestamp ?? state.birthdayMonthHint?.timestamp);
    if (
      selectedBirthdayHeight === undefined &&
      selectedBirthdayTimestamp === undefined
    ) {
      throw new OneKeyLocalError(
        'zcash: select a privacy recovery month before enabling',
      );
    }
    // Checked before anything is registered: direct callers (debug gallery,
    // repair panel) bypass the generic pre-check.
    await this.backgroundApi.servicePrivacyChain.assertEnabledAccountLimit({
      networkId,
      accountId,
    });

    // Viewing keys need the seed (password) or the device; metadata already on
    // disk (e.g. resuming a paused account) needs neither prompt.
    const existingMeta =
      await this.backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta({
        accountId,
      });
    // A process can stop after persisting the birthday intent but before the
    // durable runtime repair. A retry must still reconcile that intent.
    const needsBirthdayUpdate =
      !!existingMeta &&
      (hasExplicitBirthday ||
        (selectedBirthdayHeight !== undefined
          ? selectedBirthdayHeight !== existingMeta.birthdayHeight
          : selectedBirthdayTimestamp !== existingMeta.birthdayTimestamp));
    const needsViewingKeyDerivation =
      !existingMeta?.birthdayHeight ||
      !(await hasZcashAccountViewingKey({
        backgroundApi: this.backgroundApi,
        networkId,
        accountId,
        vkFp: existingMeta.vkFp,
      }));
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    const isHwWallet = accountUtils.isHwWallet({ walletId });
    let password: string | undefined;
    let deviceParams: IDeviceSharedCallParams | undefined;
    if (needsViewingKeyDerivation) {
      if (isHwWallet) {
        deviceParams =
          await this.backgroundApi.serviceAccount.getWalletDeviceParams({
            walletId,
            hardwareCallContext: EHardwareCallContext.USER_INTERACTION,
          });
      } else {
        ({ password } =
          await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount(
            {
              accountId,
              reason: EReasonForNeedPassword.CreateTransaction,
            },
          ));
      }
    }
    await this.assertZcashAccountContext({ networkId, accountId });
    await this.backgroundApi.simpleDb.privacyChainState.beginZcashPrivacyModeEnable(
      {
        networkId,
        accountId,
        birthdayHeight: selectedBirthdayHeight,
        birthdayTimestamp: selectedBirthdayTimestamp,
        resetResumeFromHeight: hasExplicitBirthday || needsBirthdayUpdate,
      },
    );

    try {
      const vault = (await vaultFactory.getVault({
        networkId,
        accountId,
      })) as VaultZcash;
      if (needsViewingKeyDerivation) {
        if (isHwWallet) {
          await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
            () => vault.zcashRetryLocalWalletSetup({ deviceParams }),
            {
              deviceParams,
              debugMethodName: 'zcashPrivacyMode.enablePrivacyMode',
            },
          );
        } else {
          await vault.zcashRetryLocalWalletSetup({ password });
        }
      }
      const meta =
        await this.backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta(
          {
            accountId,
          },
        );
      if (!meta) {
        throw new OneKeyLocalError(
          'zcash: viewing metadata was not persisted during privacy setup',
        );
      }

      const enableFromHeight =
        (!hasExplicitBirthday && !needsBirthdayUpdate
          ? state.resumeFromHeight
          : undefined) ??
        meta.birthdayHeight ??
        selectedBirthdayHeight;
      if (enableFromHeight === undefined) {
        throw new OneKeyLocalError(
          'zcash: privacy birthday was not resolved during setup',
        );
      }
      let birthday: IRescanLocalWalletFrom | undefined;
      if (needsBirthdayUpdate) {
        birthday =
          selectedBirthdayHeight !== undefined
            ? { type: 'height', height: selectedBirthdayHeight }
            : {
                type: 'timestamp',
                timestamp: checkIsDefined(selectedBirthdayTimestamp),
              };
      }
      await vault.zcashPreparePrivacyModeAccount({
        accountId,
        fromHeight: enableFromHeight,
        birthday,
        onPrepared: async () => {
          const settings = await getVaultSettings({ networkId });
          await this.assertZcashAccountContext({ networkId, accountId });
          await this.backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeEnable(
            {
              accountId,
              maxEnabledAccounts: settings.localWallet?.maxEnabledAccounts,
            },
          );
        },
      });
    } catch (error) {
      await this.backgroundApi.simpleDb.privacyChainState.cancelZcashPendingEnables(
        {
          networkId,
          accountId,
        },
      );
      throw error;
    }
    // The account is already on and past rollback; a notification failure
    // must not report the enable as failed.
    try {
      await this.backgroundApi.servicePrivacyChain.onLocalWalletAccountsChanged(
        {
          networkId,
          accountIds: [accountId],
          backfillActive: true,
        },
      );
    } catch (error) {
      console.error(
        '[zcash] privacy enable completed but notification failed',
        error instanceof Error ? error.message : '',
      );
    }
  }

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
    const meta =
      await this.backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta({
        accountId,
      });
    const lifecycleMutex = getZcashLifecycleMutex(meta?.vkFp ?? accountId);
    await lifecycleMutex.runExclusive(async () => {
      const state =
        await this.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
          {
            accountId,
          },
        );
      if (state.intent !== 'on' || state.operation !== undefined) {
        await this.backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeDisable(
          {
            accountId,
          },
        );
        return;
      }
      const vault = (await vaultFactory.getChainOnlyVault({
        networkId,
      })) as VaultZcash;
      const capability = requireLocalWalletCapability(vault);
      const progress = await capability.getSyncProgress({ accountId });
      const birthdayHeight =
        state.birthdayHeight ?? progress?.birthdayHeight ?? undefined;
      if (birthdayHeight === undefined) {
        throw new OneKeyLocalError(
          'zcash: privacy birthday is missing while disabling',
        );
      }
      await this.backgroundApi.simpleDb.privacyChainState.beginZcashPrivacyModeDisable(
        {
          accountId,
          resumeFromHeight: getPrivacyModeResumeFromHeight({
            progress,
            birthdayHeight,
          }),
        },
      );
      await this.backgroundApi.simpleDb.privacyChainState.completeZcashPrivacyModeDisable(
        {
          accountId,
        },
      );
    });
    await this.backgroundApi.servicePrivacyChain.onLocalWalletAccountsChanged({
      networkId,
      accountIds: [accountId],
      backfillActive: false,
    });
  }

  // The viewing key never reaches the UI; the vault capability uses this for
  // addresses and birthday fields.
  async getLocalWalletAccountMeta({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }): Promise<IZcashAccountMeta | undefined> {
    await this.assertZcashAccountContext({ networkId, accountId });
    // A read never takes the operation mutex: holding it would make an enable
    // or disable look in flight. Mid-operation there is no settled meta, and
    // the persisted state already says so.
    if (getZcashPrivacyModeOperationMutex(accountId).isLocked()) {
      return undefined;
    }
    const privacyModeEnabled =
      await this.backgroundApi.simpleDb.privacyChainState.isZcashPrivacyModeEnabled(
        {
          accountId,
        },
      );
    if (!privacyModeEnabled) {
      return undefined;
    }
    const vault = (await vaultFactory.getChainOnlyVault({
      networkId,
    })) as VaultZcash;
    return vault.getLocalWalletAccountMeta({ accountId });
  }
}
