import type { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

interface ISwapKlineOpenParams {
  defaultSide: ESwapDirectionType;
  tokenSymbol: string;
  network: string;
  fromTokenSymbol?: string;
  toTokenSymbol?: string;
}

interface ISwapKlineTokenSwitchParams {
  fromSide: ESwapDirectionType;
  toSide: ESwapDirectionType;
  tokenSymbol: string;
  network: string;
}

export class SwapKlineScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapKlineOpen(params: ISwapKlineOpenParams) {
    return params;
  }

  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapKlineTokenSwitch(params: ISwapKlineTokenSwitchParams) {
    return params;
  }
}
