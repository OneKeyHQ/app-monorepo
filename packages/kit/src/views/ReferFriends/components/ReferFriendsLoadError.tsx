import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// First load failed and there is nothing to show yet.
export function ReferFriendsLoadError({
  testID,
  onRetry,
}: {
  testID: string;
  onRetry: () => void;
}) {
  const intl = useIntl();
  return (
    <Empty
      flex={1}
      icon="CloudOffOutline"
      title={intl.formatMessage({ id: ETranslations.global_network_error })}
      description={intl.formatMessage({
        id: ETranslations.global_network_error_help_text,
      })}
      buttonProps={{
        testID,
        children: intl.formatMessage({ id: ETranslations.global_retry }),
        onPress: onRetry,
      }}
    />
  );
}
