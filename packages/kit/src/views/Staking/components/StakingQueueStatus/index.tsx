import { useCallback, useEffect } from 'react';

import { Badge } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

export const StakingQueueStatus = () => {
  const appNavigation = useAppNavigation();
  const headerRight = useCallback(
    () => (
      <Badge badgeType="info" badgeSize="lg">
        Pending
      </Badge>
    ),
    [],
  );
  useEffect(() => {
    appNavigation.setOptions({ headerRight });
  }, [appNavigation, headerRight]);
  return null;
};
