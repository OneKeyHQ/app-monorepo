import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import type { ETranslations } from '@onekeyhq/shared/src/locale';

export function SectionHeader({
  translationId,
}: {
  translationId: ETranslations;
}) {
  const intl = useIntl();
  return (
    <Stack px="$5" pt="$5">
      <SizableText size="$headingLg">
        {intl.formatMessage({ id: translationId })}
      </SizableText>
    </Stack>
  );
}
