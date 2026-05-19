import type { EExchangeId } from '@onekeyhq/shared/src/consts/exchangeConsts';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export type IReceiveExchangeSource = EExchangeId | 'others';

export class ReceiveScene extends BaseScene {
  @LogToServer()
  public showReceived({
    walletType,
    isSuccess,
    failedReason,
  }: {
    walletType: string | undefined;
    isSuccess: boolean;
    failedReason: string | undefined;
  }) {
    return {
      walletType,
      isSuccess,
      failedReason,
    };
  }

  @LogToServer()
  public clickExchangeEntry({
    exchangeSource,
    walletType,
  }: {
    exchangeSource: IReceiveExchangeSource;
    walletType: string | undefined;
  }) {
    return {
      exchangeSource,
      walletType,
    };
  }
}
