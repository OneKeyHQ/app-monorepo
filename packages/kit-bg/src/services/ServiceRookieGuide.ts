import BigNumber from 'bignumber.js';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  ERookieTaskType,
  type IRookieGuideInfo,
  type IRookieGuideOneKeyIdInfo,
  type IRookieGuideProgress,
} from '@onekeyhq/shared/types/rookieGuide';

import { activeAccountValueAtom } from '../states/jotai/atoms';
import { primePersistAtom } from '../states/jotai/atoms/prime';

import ServiceBase from './ServiceBase';

const DEFAULT_BALANCE_INFO = { balance: '0', currency: 'usd' };

@backgroundClass()
class ServiceRookieGuide extends ServiceBase {
  @backgroundMethod()
  async getRookieGuideInfo(): Promise<IRookieGuideInfo> {
    // Auto-activate when H5 calls this method (user opened the guide page)
    await this.backgroundApi.simpleDb.rookieGuide.activate();
    defaultLogger.rookieGuide.guide.activated();

    const [
      taskProgress,
      balanceInfo,
      oneKeyId,
      instanceId,
      hyperliquidReferral,
      locale,
    ] = await Promise.all([
      this.getTaskProgress(),
      this._getActiveFiatBalance(),
      this._getOneKeyIdInfo(),
      this.backgroundApi.serviceSetting.getInstanceId(),
      this._getHyperliquidReferralEligibility(),
      this.backgroundApi.serviceSetting.getCurrentLocale(),
    ]);

    const result: IRookieGuideInfo = {
      fiatBalance: balanceInfo.balance,
      currency: balanceInfo.currency,
      oneKeyId,
      instanceId,
      taskProgress,
      hyperliquidReferral,
      locale,
    };

    defaultLogger.rookieGuide.guide.getInfo({
      fiatBalance: result.fiatBalance,
      currency: result.currency,
      isLoggedIn: oneKeyId.isLoggedIn,
      instanceId,
    });

    return result;
  }

  @backgroundMethod()
  async getTaskProgress(): Promise<IRookieGuideProgress> {
    const progress =
      await this.backgroundApi.simpleDb.rookieGuide.getProgress();
    const completedTasks = (Object.keys(progress) as ERookieTaskType[]).filter(
      (key) => progress[key],
    );
    defaultLogger.rookieGuide.guide.getProgress({
      completedTasks,
      totalTasks: 6,
    });
    return progress;
  }

  @backgroundMethod()
  async recordTaskCompleted(taskType: ERookieTaskType): Promise<void> {
    // Only record if user has opened the guide page
    const isActivated =
      await this.backgroundApi.simpleDb.rookieGuide.isActivated();

    defaultLogger.rookieGuide.guide.taskCompleted({
      taskType,
      isActivated,
    });

    if (!isActivated) {
      return;
    }
    await this.backgroundApi.simpleDb.rookieGuide.recordTaskCompleted(taskType);
  }

  @backgroundMethod()
  async resetProgress(): Promise<void> {
    defaultLogger.rookieGuide.guide.resetProgress();
    await this.backgroundApi.simpleDb.rookieGuide.resetProgress();
  }

  private async _getActiveFiatBalance(): Promise<{
    balance: string;
    currency: string;
  }> {
    try {
      const accountValue = await activeAccountValueAtom.get();
      if (!accountValue) {
        return DEFAULT_BALANCE_INFO;
      }

      const { value, currency } = accountValue;
      const balance =
        typeof value === 'string'
          ? value
          : Object.values(value)
              .reduce((acc, val) => acc.plus(val || '0'), new BigNumber(0))
              .toFixed();

      return { balance, currency: currency || 'usd' };
    } catch {
      return DEFAULT_BALANCE_INFO;
    }
  }

  private async _getOneKeyIdInfo(): Promise<IRookieGuideOneKeyIdInfo> {
    try {
      const primeInfo = await primePersistAtom.get();
      return {
        isLoggedIn: primeInfo?.isLoggedIn ?? false,
        email: primeInfo?.email ?? primeInfo?.displayEmail,
        userId: primeInfo?.onekeyUserId,
      };
    } catch {
      return { isLoggedIn: false };
    }
  }

  // Account identity (indexedAccountId / accountId) comes from the home scene
  // selector so we target the same HD index the user is currently viewing.
  // deriveType, however, must come from the user's GLOBAL EVM preference for
  // PERPS_NETWORK_ID — the home scene's deriveType may be a non-EVM value
  // (e.g. 'native_segwit' when home is on BTC) which would fail EVM resolution.
  private async _getHyperliquidReferralEligibility(): Promise<
    IRookieGuideInfo['hyperliquidReferral']
  > {
    try {
      const homeSelected =
        await this.backgroundApi.simpleDb.accountSelector.getSelectedAccount({
          sceneName: EAccountSelectorSceneName.home,
          num: 0,
        });

      const indexedAccountId = homeSelected?.indexedAccountId;
      const accountId = indexedAccountId || homeSelected?.othersWalletAccountId;
      if (!accountId) {
        defaultLogger.rookieGuide.guide.hyperliquidReferralResolved({
          skipped: 'no_account',
        });
        return undefined;
      }

      const deriveType =
        await this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: PERPS_NETWORK_ID,
        });

      const res =
        await this.backgroundApi.serviceHyperliquidReferral.checkBannerReferralEligibility(
          {
            accountId,
            indexedAccountId,
            deriveType,
          },
        );

      const result = {
        eligible: res.shouldShow,
        reason: res.reason ?? (res.shouldShow ? 'eligible' : 'unknown'),
        address: res.resolvedAddress || undefined,
      };

      defaultLogger.rookieGuide.guide.hyperliquidReferralResolved({
        accountId,
        indexedAccountId,
        deriveType,
        eligible: result.eligible,
        reason: result.reason,
        address: result.address,
      });

      return result;
    } catch (error) {
      // Silent fail — errors here must not break the rest of the guide response
      defaultLogger.rookieGuide.guide.hyperliquidReferralResolved({
        skipped: 'catch_error',
        catchError: (error as Error)?.message ?? String(error),
      });
      return undefined;
    }
  }

  /**
   * Check and record DEPOSIT task completion for rookie guide.
   * Conditions: HD/Keyless/HW Wallet with balance > 0
   */
  @backgroundMethod()
  async checkAndRecordDepositTask(accountId: string): Promise<void> {
    try {
      // Only track for HD, Keyless, and HW accounts
      const isEligibleAccount =
        accountUtils.isHdAccount({ accountId }) ||
        accountUtils.isKeylessAccount({ accountId }) ||
        accountUtils.isHwAccount({ accountId });

      if (!isEligibleAccount) {
        return;
      }

      // Get current balance
      const accountValue = await activeAccountValueAtom.get();
      if (accountValue?.accountId !== accountId) {
        return;
      }

      let totalBalance = '0';
      if (typeof accountValue.value === 'string') {
        totalBalance = accountValue.value;
      } else {
        totalBalance = Object.values(accountValue.value || {}).reduce(
          (acc, v) => new BigNumber(acc).plus(v || '0').toFixed(),
          '0',
        );
      }

      const willRecord = new BigNumber(totalBalance).gt(0);

      defaultLogger.rookieGuide.guide.checkDepositTask({
        accountId,
        isEligible: isEligibleAccount,
        balance: totalBalance,
        willRecord,
      });

      // Record if balance > 0
      if (willRecord) {
        await this.recordTaskCompleted(ERookieTaskType.DEPOSIT);
      }
    } catch (error) {
      defaultLogger.rookieGuide.guide.error({
        method: 'checkAndRecordDepositTask',
        error: (error as Error)?.message || 'Unknown error',
      });
      // Silent fail - don't break main flow
    }
  }
}

export default ServiceRookieGuide;
