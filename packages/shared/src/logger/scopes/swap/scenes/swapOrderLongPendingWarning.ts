import type { ISwapOrderLongPendingWarningPayload } from '@onekeyhq/shared/src/utils/swapHistoryUtils';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class SwapOrderLongPendingWarningScene extends BaseScene {
  @LogToServer({ level: 'info' })
  @LogToLocal({ level: 'info' })
  public swapOrderLongPendingWarning(
    payload: ISwapOrderLongPendingWarningPayload,
  ) {
    return payload;
  }
}
