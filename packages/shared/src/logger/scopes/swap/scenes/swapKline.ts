import type { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

interface ISwapKlineOpenParams {
  defaultSide: ESwapDirectionType;
  tokenSymbol: string;
  network: string;
  fromTokenSymbol?: string;
  toTokenSymbol?: string;
  initialPeriod?: string;
  fallbackTriggered?: 'yes' | 'no';
}

interface ISwapKlineTokenSwitchParams {
  fromSide: ESwapDirectionType;
  toSide: ESwapDirectionType;
  tokenSymbol: string;
  network: string;
}

interface ISwapKlinePeriodChangeParams {
  fromPeriod: string;
  toPeriod: string;
  tokenSymbol: string;
}

interface ISwapKlineLoadErrorParams {
  status: 'empty' | 'failed';
  tokenSymbol: string;
  network: string;
  period: string;
  message?: string;
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

  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapKlinePeriodChange(params: ISwapKlinePeriodChangeParams) {
    return params;
  }

  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapKlineLoadError(params: ISwapKlineLoadErrorParams) {
    return params;
  }
}
