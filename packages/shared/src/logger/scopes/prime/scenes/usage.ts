import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type {
  ETranslateDisplayMode,
  ETranslateEngine,
} from '@onekeyhq/shared/types/discovery';
import type { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

import type { IPrimeAddressRiskCheckEntryPoint } from '../types';

type IReceiveKytFeatureName = EPrimeFeatures.ReceiveRiskMonitoring;

export class PrimeUsageScene extends BaseScene {
  /**
   * 使用 OneKey Cloud
   * 触发时机: Prime 用户点击 OneKey Cloud 的开关时触发
   */
  @LogToServer()
  public onekeyCloudToggle({ status }: { status: 'on' | 'off' }) {
    return {
      status,
    };
  }

  /**
   * 使用批量复制地址
   * 触发时机: Prime 用户成功执行一次"批量复制地址"操作后触发
   */
  @LogToServer()
  public bulkCopyAddressSuccess() {
    return {};
  }

  /**
   * Bulk send usage
   * Triggered when a Prime user successfully completes a bulk send operation
   */
  @LogToServer()
  public bulkSendSuccess({
    recipientCount,
    sendMode,
    network,
    tokenSymbol,
  }: {
    recipientCount: number;
    sendMode: EBulkSendMode;
    network: string;
    tokenSymbol: string;
  }) {
    return {
      recipientCount,
      sendMode,
      network,
      tokenSymbol,
    };
  }

  /**
   * 使用批量撤销
   * 触发时机: Prime 用户成功执行一次"批量撤销"操作后触发
   */
  @LogToServer()
  public bulkRevokeSuccess({ revokeCount }: { revokeCount: number }) {
    return {
      revokeCount,
    };
  }

  /**
   * Address risk check usage.
   * Triggered when a Prime user successfully completes an address risk check.
   */
  @LogToServer()
  public addressRiskCheckSuccess(params: {
    entryPoint: IPrimeAddressRiskCheckEntryPoint;
    network: string;
    riskLevel: EKytRiskLevel;
    riskFactorsCount: number;
    cached: boolean;
  }) {
    return params;
  }

  @LogToServer()
  public dappTranslateSuccess({
    engine,
    targetLang,
    displayMode,
    dappDomain,
  }: {
    engine: ETranslateEngine;
    targetLang: string;
    displayMode: ETranslateDisplayMode;
    dappDomain: string;
  }) {
    return {
      engine,
      targetLang,
      displayMode,
      dappDomain,
    };
  }

  /**
   * Triggered when the receive risk monitoring intro dialog is shown.
   */
  @LogToServer()
  public primeReceiveKytIntroShown(params: {
    featureName: IReceiveKytFeatureName;
    entryPoint: 'homeAutoIntro';
    isPrimeActive: true;
  }) {
    return params;
  }

  /**
   * Triggered when the user acts on the receive risk monitoring intro dialog.
   */
  @LogToServer()
  public primeReceiveKytIntroAction(params: {
    featureName: IReceiveKytFeatureName;
    entryPoint: 'homeAutoIntro';
    isPrimeActive: true;
    action: 'enable' | 'dismiss' | 'learnMore';
  }) {
    return params;
  }
}
