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
    return (await this.getRawData()) ?? {};
  }

  @backgroundMethod()
  async recordTaskCompleted(taskType: ERookieTaskType): Promise<void> {
    await this.setRawData((current) => {
      const progress = current ?? {};
      // Idempotent: skip if already completed
      if (progress[taskType]) {
        return progress;
      }
      return { ...progress, [taskType]: Date.now() };
    });
  }

  @backgroundMethod()
  async resetProgress(): Promise<void> {
    await this.setRawData({});
  }
}
