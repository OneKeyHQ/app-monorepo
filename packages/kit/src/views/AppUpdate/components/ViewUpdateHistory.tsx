import { useCallback } from 'react';

import { Button, XStack } from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function ViewUpdateHistory() {
  const handlePress = useCallback(() => {
    openUrlExternal('https://github.com/OneKeyHQ/app-monorepo/releases');
  }, []);
  return (
    <XStack>
      <Button
        mt="$5"
        iconAfter="ArrowTopRightOutline"
        onPress={handlePress}
        size="small"
      >
        Update History
      </Button>
    </XStack>
  );
}
