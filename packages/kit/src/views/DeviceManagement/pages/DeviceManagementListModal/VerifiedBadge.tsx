import { useIntl } from 'react-intl';

import { Icon, Tooltip } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function VerifiedBadge({ isVerified }: { isVerified: boolean }) {
  const intl = useIntl();

  if (isVerified) {
    return null;
  }

  return (
    <Tooltip
      placement="top"
      renderTrigger={<Icon name="ErrorSolid" color="$iconCritical" size="$4" />}
      renderContent={intl.formatMessage({
        id: ETranslations.global_unverified,
      })}
    />
  );
}
