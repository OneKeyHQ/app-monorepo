import type {
  ESwapDirectionType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class TokenSelectorSearchScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public swapTokenSelectorSearch(params: {
    query: string;
    resultCount: number;
    networkId: string;
    networkName: string;
    direction: ESwapDirectionType;
    from?: ESwapTabSwitchType | 'pro';
  }) {
    return params;
  }
}
