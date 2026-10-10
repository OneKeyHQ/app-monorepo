import { useIntl } from 'react-intl';

import { Divider, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// Splits side-by-side alternatives on pointer layouts; compact layouts state
// the "meet any one" rule in text instead.
export function OrDivider() {
  const intl = useIntl();
  const upperLabel = intl
    .formatMessage({ id: ETranslations.global_or })
    .toUpperCase();

  return (
    <YStack ai="center" jc="center" gap="$2" px="$1">
      <Divider flex={1} vertical />
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {upperLabel}
      </SizableText>
      <Divider flex={1} vertical />
    </YStack>
  );
}
