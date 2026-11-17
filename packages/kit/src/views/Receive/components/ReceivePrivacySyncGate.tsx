import { useIntl } from 'react-intl';

import { Button, Icon, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReceiveCardCell } from './ReceiveCard';

export function ReceivePrivacySyncGate({
  paused = false,
  onEnable,
  loading = false,
}: {
  paused?: boolean;
  onEnable: () => void;
  loading?: boolean;
}) {
  const intl = useIntl();
  return (
    <ReceiveCardCell
      testID="receive-privacy-sync-gate"
      minHeight={320}
      p="$6"
      alignItems="center"
      justifyContent="center"
      gap="$5"
    >
      <YStack
        p="$4"
        bg="$bgSubdued"
        borderRadius="$full"
        alignItems="center"
        justifyContent="center"
      >
        <Icon name="LockOutline" size="$8" color="$iconSubdued" />
      </YStack>
      <SizableText size="$bodyLgMedium" textAlign="center" maxWidth={256}>
        {intl.formatMessage({
          id: ETranslations.privacy_receive_needs_sync__msg,
        })}
      </SizableText>
      <Button
        testID="receive-open-privacy-settings"
        variant="primary"
        loading={loading}
        onPress={onEnable}
      >
        {intl.formatMessage({
          id: paused
            ? ETranslations.global_resume
            : ETranslations.global_enable,
        })}
      </Button>
    </ReceiveCardCell>
  );
}
