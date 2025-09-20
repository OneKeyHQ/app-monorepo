import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function EmptyToken() {
  const intl = useIntl();

  return (
    <Empty
      h={platformEnv.isNativeAndroid ? 300 : undefined}
      testID="Wallet-No-Token-Empty"
      icon="CoinsOutline"
      title={intl.formatMessage({ id: ETranslations.send_no_token_message })}
    />
  );
}

export { EmptyToken };
