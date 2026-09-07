import { useCallback, useEffect, useState } from 'react';

import {
  type RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  ESwitchSize,
  Icon,
  Page,
  SizableText,
  Spinner,
  Switch,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSettingRoutes,
  IModalSettingParamList,
} from '@onekeyhq/shared/src/routes';

import { SettingTestIDs } from '../../testIDs';
import { SETTINGS_PAGE_BODY_INSET_X } from '../Tab/settingsSurface';

import { TRAVEL_MODE_COPY } from './copy';

export default function TravelMode() {
  const intl = useIntl();
  const navigation =
    useNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const route =
    useRoute<
      RouteProp<
        IModalSettingParamList,
        EModalSettingRoutes.SettingTravelModeModal
      >
    >();
  const admissionId = route.params?.admissionId;
  const [enabled, setEnabled] = useState<boolean | undefined>();
  const [isSwitching, setIsSwitching] = useState(false);
  const [restartFailed, setRestartFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    if (!admissionId) {
      navigation.pop();
      return undefined;
    }
    void backgroundApiProxy.serviceTravelMode
      .enterPage({ admissionId })
      .then((status) => {
        if (!disposed) {
          setEnabled(status.enabled);
          setRestartFailed(status.restartRequired);
        }
      })
      .catch(() => navigation.pop());

    return () => {
      disposed = true;
      void backgroundApiProxy.serviceTravelMode
        .leavePage({ admissionId })
        .catch(() => undefined);
    };
  }, [admissionId, navigation]);

  useEffect(() => {
    if (!isSwitching && !restartFailed) {
      return undefined;
    }
    return navigation.addListener('beforeRemove', (event) => {
      event.preventDefault();
    });
  }, [isSwitching, navigation, restartFailed]);

  const applyTravelModeChange = useCallback(
    async (nextEnabled: boolean) => {
      if (!admissionId || isSwitching || nextEnabled === enabled) {
        return;
      }
      setIsSwitching(true);
      setRestartFailed(false);
      const restartLoadingDialog = Dialog.loading({
        title: TRAVEL_MODE_COPY.restartingTitle,
        description: TRAVEL_MODE_COPY.restartingDescription,
      });
      try {
        await backgroundApiProxy.serviceTravelMode.setEnabled({
          admissionId,
          enabled: nextEnabled,
        });
      } catch {
        setRestartFailed(true);
        try {
          const status = await backgroundApiProxy.serviceTravelMode.enterPage({
            admissionId,
          });
          setEnabled(status.enabled);
          const shouldRetryRestart =
            status.restartRequired || status.enabled === nextEnabled;
          setRestartFailed(shouldRetryRestart);
          if (!shouldRetryRestart) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_unknown_error_retry_message,
              }),
            });
          }
        } catch {
          // A lost background response may be the restart taking effect. Keep
          // this runtime blocked unless the background explicitly confirms a
          // pre-commit failure in the old state.
          setRestartFailed(true);
        }
      } finally {
        await restartLoadingDialog.close();
        setIsSwitching(false);
      }
    },
    [admissionId, enabled, intl, isSwitching],
  );

  const onChange = useCallback(
    (nextEnabled: boolean) => {
      if (!admissionId || isSwitching || nextEnabled === enabled) {
        return;
      }
      if (!nextEnabled) {
        void applyTravelModeChange(false);
        return;
      }
      Dialog.show({
        icon: 'LuggagePackageOutline',
        title: TRAVEL_MODE_COPY.enableConfirmationTitle,
        description: TRAVEL_MODE_COPY.enableConfirmationDescription,
        renderContent: (
          <SizableText size="$bodyMd" color="$textSubdued">
            {TRAVEL_MODE_COPY.enableConfirmationDetails}
          </SizableText>
        ),
        onCancelText: TRAVEL_MODE_COPY.enableConfirmationCancel,
        onConfirmText: TRAVEL_MODE_COPY.enableConfirmationConfirm,
        onCancel: (close) => {
          void close();
        },
        onConfirm: async ({ close }) => {
          await close();
          await applyTravelModeChange(true);
        },
      });
    },
    [admissionId, applyTravelModeChange, enabled, isSwitching],
  );

  const retryRestart = useCallback(async () => {
    if (!admissionId) {
      return;
    }
    setIsSwitching(true);
    const restartLoadingDialog = Dialog.loading({
      title: TRAVEL_MODE_COPY.restartingTitle,
      description: TRAVEL_MODE_COPY.restartingDescription,
    });
    try {
      await backgroundApiProxy.serviceTravelMode.retryRestart({ admissionId });
    } catch {
      setRestartFailed(true);
    } finally {
      await restartLoadingDialog.close();
      setIsSwitching(false);
    }
  }, [admissionId]);

  return (
    <Page>
      <Page.Header title={TRAVEL_MODE_COPY.title} />
      <Page.Body px={SETTINGS_PAGE_BODY_INSET_X} gap="$5">
        {enabled === undefined ? (
          <Spinner size="large" />
        ) : (
          <>
            <YStack borderRadius="$3" bg="$bgSubdued">
              <ListItem
                icon="LuggagePackageOutline"
                title={TRAVEL_MODE_COPY.title}
                subtitle={
                  enabled
                    ? TRAVEL_MODE_COPY.enabledSwitchDescription
                    : TRAVEL_MODE_COPY.disabledSwitchDescription
                }
              >
                <Switch
                  testID={SettingTestIDs.travelModeSwitch}
                  size={ESwitchSize.small}
                  value={enabled}
                  disabled={isSwitching || restartFailed}
                  onChange={onChange}
                />
              </ListItem>
            </YStack>

            <YStack p="$5" gap="$3" borderRadius="$3" bg="$bgSubdued">
              <XStack gap="$2" alignItems="center">
                <Icon name="InfoCircleOutline" size="$5" color="$iconInfo" />
                <SizableText size="$headingSm">
                  {TRAVEL_MODE_COPY.explanationTitle}
                </SizableText>
              </XStack>
              <SizableText size="$bodyMd" color="$textSubdued">
                {TRAVEL_MODE_COPY.description}
              </SizableText>
              <YStack gap="$2">
                {TRAVEL_MODE_COPY.details.map((detail) => (
                  <XStack key={detail} gap="$2" alignItems="flex-start">
                    <SizableText size="$bodyMd" color="$textSubdued">
                      •
                    </SizableText>
                    <SizableText flex={1} size="$bodyMd" color="$textSubdued">
                      {detail}
                    </SizableText>
                  </XStack>
                ))}
              </YStack>
            </YStack>

            {enabled ? (
              <YStack p="$5" gap="$2" borderRadius="$3" bg="$bgSuccessSubdued">
                <XStack gap="$2" alignItems="center">
                  <Icon name="CheckRadioSolid" size="$5" color="$iconSuccess" />
                  <SizableText size="$headingSm">
                    {TRAVEL_MODE_COPY.enabledMessage}
                  </SizableText>
                </XStack>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {TRAVEL_MODE_COPY.enabledDescription}
                </SizableText>
              </YStack>
            ) : null}

            {restartFailed ? (
              <YStack p="$5" gap="$3" borderRadius="$3" bg="$bgCautionSubdued">
                <SizableText size="$bodyMd">
                  {intl.formatMessage({
                    id: ETranslations.global_unknown_error_retry_message,
                  })}
                </SizableText>
                <Button
                  testID={SettingTestIDs.travelModeRestartButton}
                  loading={isSwitching}
                  onPress={retryRestart}
                >
                  {intl.formatMessage({ id: ETranslations.global_retry })}
                </Button>
              </YStack>
            ) : null}
          </>
        )}
      </Page.Body>
    </Page>
  );
}
