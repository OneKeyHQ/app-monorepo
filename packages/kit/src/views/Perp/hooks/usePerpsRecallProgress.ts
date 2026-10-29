import { useEffect, useState } from 'react';

import { onVisibilityStateChange } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useDevSettingsPersistAtom,
  usePerpsActiveAccountAtom,
  usePerpsRecallProgressAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export function usePerpsRecallProgress() {
  const [{ instanceId }] = useSettingsPersistAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const isWatchingAccount = accountUtils.isWatchingAccount({
    accountId: activeAccount.accountId ?? '',
  });
  const [snapshot] = usePerpsRecallProgressAtom();
  const { run: refresh } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.fetchPerpsRecallProgress(),
    // Refresh the device-scoped request when identity or endpoint settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instanceId, devSettings],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ minute: 1 }),
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      undefinedResultIfError: true,
    },
  );

  useEffect(
    () =>
      onVisibilityStateChange((visible) => {
        if (visible) void refresh();
      }),
    [refresh],
  );

  const progress =
    !isWatchingAccount &&
    snapshot.instanceId === instanceId.trim().toLowerCase()
      ? snapshot.progress
      : null;
  const [now, setNow] = useState(Date.now);
  const deadline = progress ? Date.parse(progress.deadline) : undefined;
  useEffect(() => {
    if (deadline === undefined || deadline <= now) return;
    const timeout = setTimeout(
      () => setNow(Date.now()),
      Math.min(
        Math.max(deadline - Date.now(), 0),
        timerUtils.getTimeDurationMs({ day: 1 }),
      ),
    );
    return () => clearTimeout(timeout);
  }, [deadline, now]);

  return {
    progress,
    refresh,
    hasEnded:
      progress?.activityStatus === 'ended' ||
      (deadline !== undefined && deadline <= now),
    instanceId,
  };
}
