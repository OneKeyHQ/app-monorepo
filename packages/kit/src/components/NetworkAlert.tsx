import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, useNetInfo } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useNetworkDoctorStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/networkDoctor';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalNetworkDoctorPages,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../hooks/useAppNavigation';

function BasicNetworkAlert() {
  const { isInternetReachable } = useNetInfo();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [doctorState] = useNetworkDoctorStateAtom();

  const handleDiagnostics = useCallback(async () => {
    // Navigate to diagnostics page
    navigation.pushModal(EModalRoutes.NetworkDoctorModal, {
      screen: EModalNetworkDoctorPages.NetworkDoctorResult,
    });

    // Only run diagnostics if not already running or completed
    // If status is 'completed', just show the result without re-running
    if (
      doctorState.status !== 'running' &&
      doctorState.status !== 'completed'
    ) {
      void backgroundApiProxy.serviceNetworkDoctor.runNetworkDiagnostics();
    }
  }, [navigation, doctorState.status]);

  // Calculate action button text based on diagnostics state
  const actionText = useMemo(() => {
    if (doctorState.status === 'running' && doctorState.progress) {
      const percentage = Math.round(doctorState.progress.percentage);
      return `${percentage}%`;
    }
    // Show 100% if completed and result hasn't been viewed yet
    if (doctorState.status === 'completed' && doctorState.result) {
      return '100%';
    }
    return intl.formatMessage({
      id: ETranslations.global_check,
    });
  }, [doctorState.status, doctorState.progress, doctorState.result, intl]);

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
      action={
        platformEnv.isNative
          ? {
              primary: actionText,
              onPrimaryPress: handleDiagnostics,
            }
          : undefined
      }
    />
  );
}

export const NetworkAlert = memo(BasicNetworkAlert);
