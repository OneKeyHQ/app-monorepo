// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class PrimeSubscriptionScene extends BaseScene {
  /**
   * 点击 Prime 功能入口
   * 触发时机: 非 Prime 用户点击任何一个 Prime 功能的入口时触发
   */
  @LogToServer()
  public primeEntryClick({
    featureName,
    entryPoint,
  }: {
    featureName: EPrimeFeatures;
    entryPoint: 'settingsPage' | 'moreActions' | 'approvalPopup' | 'primePage';
  }) {
    return {
      featureName,
      entryPoint,
    };
  }

  /**
   * 展示 Prime 功能介绍/引导弹窗
   * 触发时机: 系统弹出功能介绍/订阅引导页（或弹窗）时触发
   */
  @LogToServer()
  public primeUpsellShow({
    featureName,
    entryPoint,
  }: {
    featureName: EPrimeFeatures;
    entryPoint?: 'settingsPage' | 'moreActions' | 'approvalPopup' | 'primePage';
  }) {
    return {
      featureName,
      entryPoint,
    };
  }

  /**
   * 点击"关于Prime"按钮
   * 触发时机: 在功能介绍/引导页上，用户点击"订阅"或类似的行动号召（CTA）按钮时触发
   */
  @LogToServer()
  public primeUpsellActionClick({
    featureName,
    entryPoint,
  }: {
    featureName: EPrimeFeatures;
    entryPoint?: 'settingsPage' | 'moreActions' | 'approvalPopup' | 'primePage';
  }) {
    return {
      featureName,
      entryPoint,
    };
  }

  /**
   * 订阅成功
   * 触发时机: 用户完成支付，成功订阅 Prime 后触发
   */
  @LogToServer()
  public primeSubscribeSuccess({
    planType,
    amount,
    currency,
  }: {
    planType: 'monthly' | 'yearly';
    amount: number;
    currency: string;
  }) {
    return {
      planType,
      amount,
      currency,
    };
  }
}
