import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export interface IValueDropTipEventParams {
  checked: boolean | undefined;
  fromTokenSymbol: string;
  fromTokenAmount: string;
  fromTokenFiatValue: string;
  fromChainNetworkId: string;
  toTokenSymbol: string;
  toTokenAmount: string;
  toTokenFiatValue: string;
  toChainNetworkId: string;
  valueDropPercent: string;
}

export class ValueDropTipScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public valueDropTipContinue(params: IValueDropTipEventParams) {
    return params;
  }

  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public valueDropTipCancel(params: IValueDropTipEventParams) {
    return params;
  }
}
