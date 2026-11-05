import type { RefObject } from 'react';

import { useMedia } from '@onekeyhq/components';
import { useVisibleImpression } from '@onekeyhq/kit/src/hooks/useVisibleImpression';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  type IPerpRecallEntrySource,
  getPerpRecallEventParams,
} from '@onekeyhq/shared/src/logger/scopes/perp/scenes/recall';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IPerpsRecallProgress } from '@onekeyhq/shared/src/referralCode/recall';

import type { ViewInstance } from 'react-native';

// The menu and activity center are portals and can remount during one Perps visit.
const seenEntries = new Set<string>();
export function resetPerpsRecallImpressions() {
  seenEntries.clear();
}

export function usePerpsRecallEntry({
  progress,
  instanceId,
  entrySource,
  enabled = true,
  viewportRef,
}: {
  progress: IPerpsRecallProgress | null;
  instanceId: string;
  entrySource: IPerpRecallEntrySource;
  enabled?: boolean;
  viewportRef?: RefObject<Pick<ViewInstance, 'measureInWindow'> | null>;
}) {
  const { gtMd } = useMedia();
  const layout = gtMd && !platformEnv.isNative ? 'wide' : 'compact';
  const params =
    progress && getPerpRecallEventParams(progress, entrySource, layout);
  const key =
    params && JSON.stringify([instanceId, entrySource, params.activityId]);
  const impressionRef = useVisibleImpression({
    impressionKey: enabled && key ? key : undefined,
    seen: seenEntries,
    viewportRef,
    onShown: () => {
      if (params && progress) {
        defaultLogger.perp.recall.perpRecallEntryShown(
          entrySource === 'banner'
            ? { ...params, closable: progress.closable }
            : params,
        );
      }
    },
  });
  return {
    impressionRef,
    trackClick: () => {
      if (params) defaultLogger.perp.recall.perpRecallEntryClicked(params);
    },
    trackDismiss: () => {
      if (!params || !progress || !key) return;
      seenEntries.delete(key);
      defaultLogger.perp.recall.perpRecallBannerDismissed({
        ...params,
        reopenAfterMinutes: progress.reopenAfterMinutes,
      });
    },
  };
}
