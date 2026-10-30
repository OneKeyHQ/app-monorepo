import { useCallback } from 'react';

import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function usePerpsRecallBannerVisibility({
  instanceId,
  activityId,
}: {
  instanceId: string;
  activityId?: string;
}) {
  const [settings, setSettings] = usePerpsCustomSettingsAtom();
  const bannerKey = `${instanceId}:${activityId ?? ''}`;
  const setBannerHidden = useCallback(
    (hidden: boolean) => {
      if (!activityId) return;
      setSettings((prev) => ({
        ...prev,
        dismissedRecallBanners: {
          ...prev.dismissedRecallBanners,
          [bannerKey]: hidden,
        },
      }));
    },
    [activityId, bannerKey, setSettings],
  );

  return {
    isBannerHidden: Boolean(
      activityId && settings.dismissedRecallBanners?.[bannerKey],
    ),
    setBannerHidden,
  };
}
