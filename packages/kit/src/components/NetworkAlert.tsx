import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Alert, useNetInfo } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalNetworkDoctorPages,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../hooks/useAppNavigation';

function BasicNetworkAlert() {
  const { isInternetReachable } = useNetInfo();
  const intl = useIntl();
  const navigation = useAppNavigation();

  const handleDiagnostics = useCallback(async () => {
    // Navigate to diagnostics page
    navigation.pushModal(EModalRoutes.NetworkDoctorModal, {
      screen: EModalNetworkDoctorPages.NetworkDoctorResult,
    });

    // Start diagnostics (singleton pattern ensures only one runs at a time)
    await backgroundApiProxy.serviceIpTable.runNetworkDiagnostics();
  }, [navigation]);

  return isInternetReachable ? null : (
    <Alert
      mt="$2"
      type="critical"
      icon="CloudOffOutline"
      title={intl.formatMessage({
        id: ETranslations.feedback_you_are_offline,
      })}
      closable={false}
      fullBleed
      action={{
        primary: 'Network Diagnostics',
        onPrimaryPress: handleDiagnostics,
      }}
    />
  );
}

export const NetworkAlert = memo(BasicNetworkAlert);
