import { useState } from 'react';

import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { getLevelOverview } from '../getLevelOverview';

export function useLevelOverview(data: IInviteLevelDetail | undefined) {
  const [, setRevision] = useState(0);
  const remainingMs =
    data?.levelPolicy === 'floor' && data.floorUntil
      ? Date.parse(data.floorUntil) - Date.now()
      : 0;

  // Polling can reuse the same response object across the protection deadline.
  useInterval(
    () => setRevision((revision) => revision + 1),
    remainingMs > 0
      ? Math.min(remainingMs, timerUtils.getTimeDurationMs({ minute: 1 }))
      : undefined,
  );

  return getLevelOverview(data);
}
