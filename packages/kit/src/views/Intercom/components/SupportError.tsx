import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function SupportError({ retry }: { retry: () => void }) {
  const intl = useIntl();
  return (
    <Empty
      title={intl.formatMessage({
        id: ETranslations.global_connet_error_try_again,
      })}
      buttonProps={{
        testID: 'support-retry',
        children: intl.formatMessage({ id: ETranslations.global_retry }),
        onPress: retry,
      }}
    />
  );
}
