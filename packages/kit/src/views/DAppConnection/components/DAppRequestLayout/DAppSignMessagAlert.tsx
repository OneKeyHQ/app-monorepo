import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function DAppSignMessageAlert() {
  const intl = useIntl();
  return (
    <Alert
      fullBleed
      type="critical"
      title={intl.formatMessage({ id: ETranslations.dapp_connect_risk_sign })}
      icon="ErrorSolid"
      borderTopWidth={0}
    />
  );
}

export { DAppSignMessageAlert };
