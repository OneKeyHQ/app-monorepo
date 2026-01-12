import BigNumber from 'bignumber.js';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  ERookieTaskType,
  IRookieGuideInfo,
  IRookieGuideOneKeyIdInfo,
  IRookieGuideProgress,
} from '@onekeyhq/shared/types/rookieGuide';

import { activeAccountValueAtom } from '../states/jotai/atoms';
import { primePersistAtom } from '../states/jotai/atoms/prime';

import ServiceBase from './ServiceBase';

const DEFAULT_BALANCE_INFO = { balance: '0', currency: 'usd' };

@backgroundClass()
class ServiceRookieGuide extends ServiceBase {
  @backgroundMethod()
  async getRookieGuideInfo(): Promise<IRookieGuideInfo> {
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
}

export default ServiceRookieGuide;
