import { useIntl } from 'react-intl';

import { Divider, SizableText, Stack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function OrDivider() {
  const intl = useIntl();
  const { md } = useMedia();
  const upperLabel = intl
    .formatMessage({ id: ETranslations.global_or })
    .toUpperCase();
  const isVertical = !md;

  return (
    <Stack
      flexDirection={isVertical ? 'column' : 'row'}
      ai="center"
      jc="center"
      gap="$2"
      py={isVertical ? 0 : '$1'}
      px={isVertical ? '$1' : 0}
    >
      <Divider flex={1} vertical={isVertical} />
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {upperLabel}
      </SizableText>
      <Divider flex={1} vertical={isVertical} />
    </Stack>
  );
}
