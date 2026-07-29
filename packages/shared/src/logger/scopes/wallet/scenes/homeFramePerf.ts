import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class HomeFramePerfScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public frame(params: {
    stage:
      | 'firstOwnerFrame'
      | 'commitBudget'
      | 'cachedFrameBarrierScheduled'
      | 'cachedFrameBarrierReleased'
      | 'cachedFrameBarrierCancelled'
      | 'functionTiming';
    walletName?: string;
    accountName?: string;
    elapsedMs?: number;
    functionName?: string;
    durationMs?: number;
    prepareDurationMs?: number;
    transportDurationMs?: number;
    previousWalletName?: string;
    previousAccountName?: string;
    partitionTag?: string;
    sectionId?: string;
    phase?: string;
    outcome?: string;
    bannerPolicyKind?: 'eligible' | 'hidden' | 'pending';
    bannerResourceKind?:
      | 'empty'
      | 'error'
      | 'idle'
      | 'loading'
      | 'partial'
      | 'ready';
    bannerPayloadParsed?: boolean;
    hasTronResource?: boolean;
    rejectReason?: string;
    requestSequence?: number;
    currentRequestSequence?: number;
    currentClientMatches?: boolean;
    currentProducerMatches?: boolean;
    currentSourceKeyMatches?: boolean;
    eventCount?: number;
    effectCount?: number;
    inputCount?: number;
    outputSectionCount?: number;
    outputItemCount?: number;
    bannerIds?: string;
    homeBannerCount?: number;
    networkMatchedBannerCount?: number;
    dismissedBannerCount?: number;
    closedForeverBannerCount?: number;
    updateCount?: number;
    listenerCount?: number;
    contributionCount?: number;
    storeCommitId?: number;
    sortDurationMs?: number;
    baseDurationMs?: number;
    startTimeMs?: number;
    commitTimeMs?: number;
    releaseReason?: 'frame' | 'timeout';
    bufferedCount?: number;
    committedCount?: number;
    peakBufferedCount?: number;
  }) {
    return params;
  }
}
