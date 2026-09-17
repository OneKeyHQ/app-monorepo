import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { ColorTokens } from 'tamagui';

export function PerpsFirstDepositPromptCard({
  backgroundColor = '$bgSubdued',
}: {
  backgroundColor?: ColorTokens;
}) {
  const intl = useIntl();

  return (
    <XStack
      testID="perp-first-deposit-prompt-card"
      gap="$2"
      px="$3"
      py="$2.5"
      borderRadius="$2"
      bg={backgroundColor}
      alignItems="center"
    >
      <Icon
        name="DownloadOutline"
        size="$4"
        color="$iconSubdued"
        flexShrink={0}
      />
      <SizableText flex={1} size="$bodySmMedium" color="$text">
        {intl.formatMessage({
          id: ETranslations.first_deposit_gets_account_ready_to_trade__desc,
        })}
      </SizableText>
    </XStack>
  );
}
