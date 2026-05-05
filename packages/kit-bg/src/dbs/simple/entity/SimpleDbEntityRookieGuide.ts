import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  ERookieTaskType,
  IRookieGuideData,
  IRookieGuideProgress,
} from '@onekeyhq/shared/types/rookieGuide';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

const DEFAULT_DATA: IRookieGuideData = {
  isActivated: false,
  progress: {},
};

export class SimpleDbEntityRookieGuide extends SimpleDbEntityBase<IRookieGuideData> {
  entityName = 'rookieGuide';

  override enableCache = false;

  @backgroundMethod()
  async getProgress(): Promise<IRookieGuideProgress> {
    const data = (await this.getRawData()) ?? DEFAULT_DATA;
    return data.progress;
  }

  @backgroundMethod()
  async isActivated(): Promise<boolean> {
    const data = (await this.getRawData()) ?? DEFAULT_DATA;
    return data.isActivated ?? false;
  }

  @backgroundMethod()
  async activate(): Promise<void> {
    await this.setRawData((current) => ({
      ...(current ?? DEFAULT_DATA),
      isActivated: true,
    }));
  }

  @backgroundMethod()
  async recordTaskCompleted(taskType: ERookieTaskType): Promise<void> {
    await this.setRawData((current) => {
      const data = current ?? DEFAULT_DATA;
      // Idempotent: skip if already completed
      if (data.progress[taskType]) {
        return data;
      }
      return {
        ...data,
        progress: { ...data.progress, [taskType]: Date.now() },
      };
    });
  }

  @backgroundMethod()
  async resetProgress(): Promise<void> {
    await this.setRawData({ isActivated: false, progress: {} });
  }
}
