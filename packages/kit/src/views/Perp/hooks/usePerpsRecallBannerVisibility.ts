import { useCallback, useEffect, useState } from 'react';

import { onVisibilityStateChange } from '@onekeyhq/components';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPerpsRecallProgress } from '@onekeyhq/shared/src/referralCode/recall';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function usePerpsRecallBannerVisibility({
  instanceId,
  progress,
}: {
  instanceId: string;
  progress: IPerpsRecallProgress | null;
}) {
  const [settings, setSettings] = usePerpsCustomSettingsAtom();
  const activityId = progress?.activityId;
  const closable = progress?.closable;
  const bannerKey = `${instanceId}:${activityId ?? ''}`;
  const dismissedAt = settings.dismissedRecallBanners?.[bannerKey];
  const reopenAfterMinutes = progress?.reopenAfterMinutes;
  const [now, setNow] = useState(Date.now);
  const setBannerHidden = useCallback(
    (hidden: boolean) => {
      if (!activityId || (hidden && !closable)) return;
      setSettings((prev) => ({
        ...prev,
        dismissedRecallBanners: {
          ...prev.dismissedRecallBanners,
          [bannerKey]: hidden ? Date.now() : false,
        },
      }));
    },
    [activityId, bannerKey, closable, setSettings],
  );

  useEffect(() => {
    if (dismissedAt !== true || !closable) return;
    // Older versions stored no timestamp; start their reminder window once.
    setSettings((prev) =>
      prev.dismissedRecallBanners?.[bannerKey] === true
        ? {
            ...prev,
            dismissedRecallBanners: {
              ...prev.dismissedRecallBanners,
              [bannerKey]: Date.now(),
            },
          }
        : prev,
    );
  }, [bannerKey, closable, dismissedAt, setSettings]);

  // Only a positive interval enables automatic reminders.
  const reopenAt =
    typeof dismissedAt === 'number' && reopenAfterMinutes
      ? dismissedAt +
        timerUtils.getTimeDurationMs({ minute: reopenAfterMinutes })
      : undefined;
  const isBannerHidden = Boolean(
    activityId &&
    progress?.title?.trim() &&
    closable &&
    (dismissedAt === true || typeof dismissedAt === 'number') &&
    (reopenAt === undefined || reopenAt > Date.now()),
  );

  useEffect(() => {
    if (!isBannerHidden || reopenAt === undefined) return;
    const timeout = setTimeout(
      () => setNow(Date.now()),
      Math.min(
        Math.max(reopenAt - Date.now(), 0),
        timerUtils.getTimeDurationMs({ day: 1 }),
      ),
    );
    return () => clearTimeout(timeout);
  }, [isBannerHidden, reopenAt, now]);

  useEffect(
    () =>
      onVisibilityStateChange((visible) => {
        if (visible) setNow(Date.now());
      }),
    [],
  );

  return {
    isBannerHidden,
    setBannerHidden,
  };
}
