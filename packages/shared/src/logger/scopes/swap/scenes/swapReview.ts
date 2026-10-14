import type {
  ISwapReviewClose,
  ISwapReviewConfirm,
  ISwapReviewOpen,
  ISwapReviewReady,
} from '@onekeyhq/shared/types/swap/reviewAnalytics';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class SwapReviewScene extends BaseScene {
  @LogToServer()
  public swapReviewOpen(params: ISwapReviewOpen) {
    return params;
  }

  @LogToServer()
  public swapReviewReady(params: ISwapReviewReady) {
    return params;
  }

  @LogToServer()
  public swapReviewConfirm(params: ISwapReviewConfirm) {
    return params;
  }

  @LogToServer()
  public swapReviewClose(params: ISwapReviewClose) {
    return params;
  }
}
