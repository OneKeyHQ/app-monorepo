import type { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class GuideScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public getInfo(params: {
    fiatBalance: string;
    currency: string;
    isLoggedIn: boolean;
    instanceId: string;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public getProgress(params: {
    completedTasks: ERookieTaskType[];
    totalTasks: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public taskCompleted(params: {
    taskType: ERookieTaskType;
    isActivated: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public checkDepositTask(params: {
    accountId: string;
    isEligible: boolean;
    balance: string;
    willRecord: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public activated() {
    return { event: 'rookie_guide_activated' };
  }

  @LogToLocal({ level: 'info' })
  public resetProgress() {
    return { event: 'rookie_guide_reset' };
  }

  @LogToLocal({ level: 'error' })
  public error(params: { method: string; error: string }) {
    return params;
  }
}
