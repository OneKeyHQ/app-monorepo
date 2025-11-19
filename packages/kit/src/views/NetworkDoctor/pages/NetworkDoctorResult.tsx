import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Empty,
  Heading,
  Icon,
  Page,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useNetworkDoctorStateAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ENetworkConnectivityLevel } from '@onekeyhq/shared/src/modules/NetworkDoctor/types';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';

import useAppNavigation from '../../../hooks/useAppNavigation';

// Hook to map connectivity level to i18n translations
const useConnectivityLevelMap = () => {
  const intl = useIntl();
  return useMemo<Record<ENetworkConnectivityLevel, string>>(
    () => ({
      [ENetworkConnectivityLevel.COMPLETELY_DOWN]: intl.formatMessage({
        id: ETranslations.global_network_doctor_conclusion_completely_down,
      }),
      [ENetworkConnectivityLevel.INTERNATIONAL_RESTRICTED]: intl.formatMessage({
        id: ETranslations.global_network_doctor_conclusion_access_limited,
      }),
      [ENetworkConnectivityLevel.ONEKEY_BLOCKED]: intl.formatMessage({
        id: ETranslations.global_network_doctor_issues_found,
      }),
      [ENetworkConnectivityLevel.ONEKEY_SERVICE_ERROR]: intl.formatMessage({
        id: ETranslations.global_network_doctor_conclusion_unknown,
      }),
      [ENetworkConnectivityLevel.HEALTHY]: intl.formatMessage({
        id: ETranslations.global_network_doctor_conclusion_healthy,
      }),
    }),
    [intl],
  );
};

function NetworkDoctorResult() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [doctorState] = useNetworkDoctorStateAtom();
  const connectivityLevelMap = useConnectivityLevelMap();

  const { status, progress, result, error } = doctorState;

  // Only reset if status is 'completed' or 'failed', not 'running'
  // This allows background diagnostics to continue if user closes the page
  useEffect(
    () => () => {
      if (status === 'completed' || status === 'failed') {
        void backgroundApiProxy.serviceNetworkDoctor.resetNetworkDiagnostics();
      }
    },
    [status],
  );

  const handleContactSupport = useCallback(() => {
    void showIntercom();
  }, []);

  const handleClose = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  // Render progress view
  const renderProgress = useMemo(() => {
    if (!progress) {
      return (
        <Empty
          flex={1}
          icon="WifiOutline"
          iconProps={{ color: '$iconActive' }}
          title={intl.formatMessage({
            id: ETranslations.global_network_doctor_initializing,
          })}
        />
      );
    }

    return (
      <YStack flex={1} alignItems="center" p="$5">
        <YStack gap="$6" alignItems="center" mt="$12" maxWidth="$96" w="100%">
          {/* Icon */}
          <Icon name="WifiOutline" size="$16" color="$iconActive" />

          {/* Title with percentage */}
          <YStack gap="$2" alignItems="center">
            <Heading size="$headingXl" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.global_network_doctor_running_title,
              })}{' '}
              ({progress.percentage}%)
            </Heading>
            <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
              {progress.message}
            </SizableText>
          </YStack>
        </YStack>
      </YStack>
    );
  }, [progress, intl]);

  // Render completed view
  const renderCompleted = useMemo(() => {
    if (!result) return null;

    const { summary } = result;
    const { conclusion } = summary;
    const isHealthy = summary.allCriticalChecksPassed;

    return (
      <YStack p="$5" gap="$5">
        {/* Empty component for icon, title, description */}
        <Empty
          p="$0"
          icon={isHealthy ? 'CheckRadioSolid' : 'ErrorSolid'}
          iconProps={{
            color: isHealthy ? '$iconSuccess' : '$iconCritical',
          }}
          title={intl.formatMessage({
            id: isHealthy
              ? ETranslations.global_network_doctor_all_checks_passed
              : ETranslations.global_network_doctor_issues_found,
          })}
          description={conclusion.summary}
        />

        {/* Diagnosis Details */}
        {!isHealthy && conclusion.suggestedActions.length > 0 ? (
          <YStack gap="$2" mt="$6">
            <Heading size="$bodyMdMedium" color="$textSubdued" pl="$4">
              {intl.formatMessage({
                id: ETranslations.global_network_doctor_suggested_actions_title,
              })}
            </Heading>
            <YStack
              p="$4"
              bg="$bgSubdued"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$neutral3"
              borderRadius="$3"
              gap="$2"
            >
              <SizableText size="$bodyMdMedium" color="$text">
                {connectivityLevelMap[conclusion.connectivityLevel]}
              </SizableText>
              <YStack gap="$1">
                {conclusion.suggestedActions.map((action, idx) => (
                  <SizableText key={idx} size="$bodyMd" color="$textSubdued">
                    {idx + 1}. {action}
                  </SizableText>
                ))}
              </YStack>
            </YStack>
          </YStack>
        ) : null}

        {/* Intermediate Issues (Debug Info) */}
        {conclusion.intermediateIssues &&
        conclusion.intermediateIssues.length > 0 ? (
          <YStack gap="$2">
            <Heading size="$headingSm">
              {intl.formatMessage({
                id: ETranslations.global_network_doctor_debug_info_title,
              })}
            </Heading>
            {conclusion.intermediateIssues.map((issue, idx) => (
              <SizableText key={idx} size="$bodyXs" color="$textDisabled">
                • {issue}
              </SizableText>
            ))}
          </YStack>
        ) : null}
      </YStack>
    );
  }, [result, intl, connectivityLevelMap]);

  // Render error view
  const renderError = useMemo(() => {
    if (!error) return null;

    return (
      <Empty
        icon="ErrorSolid"
        iconProps={{ color: '$iconCritical' }}
        title={intl.formatMessage({
          id: ETranslations.global_network_doctor_error_title,
        })}
        description={`${intl.formatMessage({
          id: ETranslations.global_an_error_occurred_desc,
        })}\n\n${String(error)}`}
        descriptionProps={{ size: '$bodyMd' }}
      />
    );
  }, [error, intl]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_network_doctor_title,
        })}
      />
      <Page.Body>
        {status === 'running' ? renderProgress : null}
        {status === 'completed' ? renderCompleted : null}
        {status === 'failed' ? renderError : null}
        {status === 'idle' ? (
          <YStack gap="$4" alignItems="center" justifyContent="center" flex={1}>
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.global_network_doctor_not_started,
              })}
            </SizableText>
            <Button variant="secondary" onPress={handleClose}>
              {intl.formatMessage({
                id: ETranslations.global_close,
              })}
            </Button>
          </YStack>
        ) : null}
      </Page.Body>
      {status === 'completed' || status === 'failed' ? (
        <Page.Footer>
          <Page.FooterActions
            onCancelText={intl.formatMessage({
              id: ETranslations.global_close,
            })}
            cancelButtonProps={{
              onPress: handleClose,
              variant: 'secondary',
            }}
            onConfirmText={
              status === 'completed' &&
              result &&
              !result.summary.allCriticalChecksPassed
                ? intl.formatMessage({
                    id: ETranslations.global_network_doctor_btn_contact_support,
                  })
                : undefined
            }
            confirmButtonProps={
              status === 'completed' &&
              result &&
              !result.summary.allCriticalChecksPassed
                ? {
                    onPress: handleContactSupport,
                    icon: 'HelpSupportOutline',
                  }
                : undefined
            }
          />
        </Page.Footer>
      ) : null}
    </Page>
  );
}

export default NetworkDoctorResult;
