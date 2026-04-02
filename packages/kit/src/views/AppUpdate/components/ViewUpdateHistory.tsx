import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function ViewUpdateHistory() {
  const intl = useIntl();
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
        {intl.formatMessage({ id: ETranslations.update_update_history })}
      </Button>
    </XStack>
  );
}
