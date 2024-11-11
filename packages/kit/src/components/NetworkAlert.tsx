import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { useNetInfo } from '@onekeyhq/shared/src/modules3rdParty/@react-native-community/netinfo';

function BasicNetworkAlert() {
  const { isInternetReachable, isRawInternetReachable } = useNetInfo();
  const intl = useIntl();
  return isInternetReachable ? null : (
    <Alert
      type="critical"
      icon="CloudOffOutline"
      title={intl.formatMessage({
        id: ETranslations.feedback_you_are_offline,
      })}
      closable={false}
      fullBleed
    />
  );
}

export const NetworkAlert = memo(BasicNetworkAlert);
