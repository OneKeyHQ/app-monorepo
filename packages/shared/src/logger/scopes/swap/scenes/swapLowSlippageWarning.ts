import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class SwapLowSlippageWarningScene extends BaseScene {
  @LogToServer({ level: 'info' })
  public swapLowSlippageWarningShow(params: {
    slippage: number;
    swapProvider: string;
  }) {
    return params;
  }

  @LogToServer({ level: 'info' })
  public swapLowSlippageWarningQuickSet(params: {
    fromSlippage: number;
    toSlippage: number;
    swapProvider: string;
  }) {
    return params;
  }
}
