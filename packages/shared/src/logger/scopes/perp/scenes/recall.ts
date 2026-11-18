import type { IPerpsRecallProgress } from '@onekeyhq/shared/src/referralCode/recall';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export type IPerpRecallEntrySource =
  | 'banner'
  | 'headerIcon'
  | 'activityHub'
  | 'perpsMenu';
export type IPerpRecallLayout = 'wide' | 'compact';

export function getPerpRecallEventParams(
  progress: IPerpsRecallProgress,
  entrySource: IPerpRecallEntrySource,
  layout: IPerpRecallLayout,
) {
  return {
    activityId: progress.activityId,
    entrySource,
    layout,
    activityStatus: progress.activityStatus,
    progressStatus: progress.status,
    payoutStatus: progress.payoutStatus,
    currentTierIndex: progress.current?.index ?? null,
  };
}

type IRecallEvent = ReturnType<typeof getPerpRecallEventParams>;

export class PerpRecallScene extends BaseScene {
  @LogToServer()
  public perpRecallEntryShown(params: IRecallEvent & { closable?: boolean }) {
    return params;
  }

  @LogToServer()
  public perpRecallEntryClicked(params: IRecallEvent) {
    return params;
  }

  @LogToServer()
  public perpRecallDetailShown(params: IRecallEvent) {
    return params;
  }

  @LogToServer()
  public perpRecallBannerDismissed(
    params: IRecallEvent & { reopenAfterMinutes: number | null },
  ) {
    return params;
  }

  @LogToServer()
  public perpRecallHelpClicked(params: IRecallEvent) {
    return params;
  }
}
