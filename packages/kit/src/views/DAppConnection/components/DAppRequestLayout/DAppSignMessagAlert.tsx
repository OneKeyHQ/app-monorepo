import { useIntl } from 'react-intl';

import type { IAlertProps } from '@onekeyhq/components';
import { Alert } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function DAppSignMessageAlert({
  signMessageAlertProps,
}: {
  signMessageAlertProps?: IAlertProps;
}) {
  const intl = useIntl();
  return (
    <Alert
      fullBleed
      type="critical"
      title={intl.formatMessage({ id: ETranslations.dapp_connect_risk_sign })}
      icon="ErrorSolid"
      borderTopWidth={0}
      {...signMessageAlertProps}
    />
  );
}

export { DAppSignMessageAlert };
