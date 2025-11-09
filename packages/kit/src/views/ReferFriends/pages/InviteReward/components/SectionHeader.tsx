import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import type { ETranslations } from '@onekeyhq/shared/src/locale';

export function SectionHeader({
  translationId,
}: {
  translationId: ETranslations;
}) {
  const intl = useIntl();
  return (
    <SizableText size="$headingLg">
      {intl.formatMessage({ id: translationId })}
    </SizableText>
  );
}
