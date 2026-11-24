import { useIntl } from 'react-intl';

import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function ReceivePrivacyPromotion({
  onEnable,
  loading = false,
  paused = false,
}: {
  onEnable: () => void;
  loading?: boolean;
  paused?: boolean;
}) {
  const intl = useIntl();
  return (
    <XStack
      testID="receive-privacy-promotion"
      bg="$bgSubdued"
      p="$3"
      gap="$3"
      borderRadius="$3"
      alignItems="center"
    >
      <Icon name="ShieldOutline" size="$5" color="$iconSubdued" />
      <SizableText size="$bodySmMedium" flex={1}>
        {intl.formatMessage({
          id: ETranslations.privacy_enable_account__title,
        })}
      </SizableText>
      <Button
        testID="receive-privacy-promotion-enable"
        size="small"
        variant="tertiary"
        loading={loading}
        onPress={onEnable}
      >
        {intl.formatMessage({
          id: paused
            ? ETranslations.global_resume
            : ETranslations.global_enable,
        })}
      </Button>
    </XStack>
  );
}
