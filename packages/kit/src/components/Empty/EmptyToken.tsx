import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function EmptyToken() {
  const intl = useIntl();

  return (
    <Empty
      mt="24%"
      testID="Wallet-No-Token-Empty"
      icon="CoinsOutline"
      title={intl.formatMessage({ id: ETranslations.send_no_token_message })}
    />
  );
}

export { EmptyToken };
