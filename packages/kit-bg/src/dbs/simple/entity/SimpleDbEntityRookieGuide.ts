import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  ERookieTaskType,
  IRookieGuideProgress,
} from '@onekeyhq/shared/types/rookieGuide';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export class SimpleDbEntityRookieGuide extends SimpleDbEntityBase<IRookieGuideProgress> {
  entityName = 'rookieGuide';

  override enableCache = false;

  @backgroundMethod()
  async getProgress(): Promise<IRookieGuideProgress> {
    const rawData = await this.getRawData();
    return rawData ?? {};
  }

  @backgroundMethod()
  async recordTaskCompleted(taskType: ERookieTaskType): Promise<void> {
    await this.setRawData((rawData) => {
      const currentProgress = rawData ?? {};
      // Only record if not already completed (idempotent)
      if (currentProgress[taskType]) {
        return currentProgress;
      }
      return {
        ...currentProgress,
        [taskType]: Date.now(),
      };
    });
  }

  @backgroundMethod()
  async resetProgress(): Promise<void> {
    await this.setRawData({});
  }
}
