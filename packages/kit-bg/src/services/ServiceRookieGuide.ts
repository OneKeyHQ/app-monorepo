import BigNumber from 'bignumber.js';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  ERookieTaskType,
  IRookieGuideInfo,
  IRookieGuideProgress,
} from '@onekeyhq/shared/types/rookieGuide';

import { activeAccountValueAtom } from '../states/jotai/atoms';
import { primePersistAtom } from '../states/jotai/atoms/prime';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceRookieGuide extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  /**
   * Get complete rookie guide info for H5 WebView
   */
  @backgroundMethod()
  async getRookieGuideInfo(): Promise<IRookieGuideInfo> {
    const [taskProgress, fiatBalanceInfo, oneKeyIdInfo, instanceId] =
      await Promise.all([
        this.getTaskProgress(),
        this._getActiveFiatBalance(),
        this._getOneKeyIdInfo(),
        this.backgroundApi.serviceSetting.getInstanceId(),
      ]);

    return {
      fiatBalance: fiatBalanceInfo.balance,
      currency: fiatBalanceInfo.currency,
      oneKeyId: oneKeyIdInfo,
      instanceId,
      taskProgress,
    };
  }

  /**
   * Get task completion progress
   */
  @backgroundMethod()
  async getTaskProgress(): Promise<IRookieGuideProgress> {
    return this.backgroundApi.simpleDb.rookieGuide.getProgress();
  }

  /**
   * Record task completion (idempotent - won't overwrite existing timestamp)
   * @param taskType The type of task completed
   */
  @backgroundMethod()
  async recordTaskCompleted(taskType: ERookieTaskType): Promise<void> {
    await this.backgroundApi.simpleDb.rookieGuide.recordTaskCompleted(taskType);
  }

  /**
   * Reset all task progress
   */
  @backgroundMethod()
  async resetProgress(): Promise<void> {
    await this.backgroundApi.simpleDb.rookieGuide.resetProgress();
  }

  /**
   * Get current active account fiat balance
   */
  private async _getActiveFiatBalance(): Promise<{
    balance: string;
    currency: string;
  }> {
    try {
      const accountValue = await activeAccountValueAtom.get();

      if (!accountValue) {
        return { balance: '0', currency: 'usd' };
      }

      const { value, currency } = accountValue;

      // value can be a string or Record<string, string> (networkId -> value)
      let totalBalance = '0';
      if (typeof value === 'string') {
        totalBalance = value;
      } else if (typeof value === 'object') {
        // Sum all network values
        totalBalance = Object.values(value)
          .reduce((acc, val) => acc.plus(val || '0'), new BigNumber(0))
          .toString();
      }

      return {
        balance: totalBalance,
        currency: currency || 'usd',
      };
    } catch {
      return { balance: '0', currency: 'usd' };
    }
  }

  /**
   * Get OneKey ID information
   */
  private async _getOneKeyIdInfo(): Promise<{
    isLoggedIn: boolean;
    email?: string;
    userId?: string;
  }> {
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
}

export default ServiceRookieGuide;
