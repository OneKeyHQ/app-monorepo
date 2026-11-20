import { useIntl } from 'react-intl';

import { Button, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function EarnAccountMarketsError({
  onRetry,
}: {
  onRetry: () => Promise<void>;
}) {
  const intl = useIntl();
  return (
    <XStack ai="center" gap="$3" flexWrap="wrap" py="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_failed })}
      </SizableText>
      <Button
        testID="earn-account-markets-retry"
        size="small"
        variant="secondary"
        onPress={() => void onRetry()}
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </XStack>
  );
}
