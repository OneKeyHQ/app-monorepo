import BigNumber from 'bignumber.js';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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

    const [taskProgress, balanceInfo, oneKeyId, instanceId] = await Promise.all(
      [
        this.getTaskProgress(),
        this._getActiveFiatBalance(),
        this._getOneKeyIdInfo(),
        this.backgroundApi.serviceSetting.getInstanceId(),
      ],
    );

    return {
      fiatBalance: balanceInfo.balance,
      currency: balanceInfo.currency,
      oneKeyId,
      instanceId,
      taskProgress,
    };
  }

  @backgroundMethod()
  async getTaskProgress(): Promise<IRookieGuideProgress> {
    return this.backgroundApi.simpleDb.rookieGuide.getProgress();
  }

  @backgroundMethod()
  async recordTaskCompleted(taskType: ERookieTaskType): Promise<void> {
    // Only record if user has opened the guide page
    const isActivated =
      await this.backgroundApi.simpleDb.rookieGuide.isActivated();
    if (!isActivated) {
      return;
    }
    await this.backgroundApi.simpleDb.rookieGuide.recordTaskCompleted(taskType);
  }

  @backgroundMethod()
  async resetProgress(): Promise<void> {
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

      // Record if balance > 0
      if (new BigNumber(totalBalance).gt(0)) {
        await this.recordTaskCompleted(ERookieTaskType.DEPOSIT);
      }
    } catch {
      // Silent fail - don't break main flow
    }
  }
}

export default ServiceRookieGuide;
