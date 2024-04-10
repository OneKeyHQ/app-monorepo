import { useCallback } from 'react';

import { Button } from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function ViewUpdateHistory() {
  const handlePress = useCallback(() => {
    openUrlExternal('https://github.com/OneKeyHQ/app-monorepo/releases');
  }, []);
  return (
    <Button
      mt="$5"
      iconAfter="ArrowTopRightOutline"
      onPress={handlePress}
      width="$54"
    >
      View Update History
    </Button>
  );
}
