import { useCallback, useMemo, useState } from 'react';

import { usePreventRemove } from '@react-navigation/core';
import noop from 'lodash/noop';
import { useIntl } from 'react-intl';

import type { IButtonProps, IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  EStepItemStatus,
  Page,
  SizableText,
  Stepper,
  Toast,
  XStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  installPackage,
  useDownloadProgress,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EAppUpdateRoutes,
  IAppUpdatePagesParamList,
} from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { HyperlinkText } from '../../../components/HyperlinkText';
import {
  useAppUpdateInfo,
  useDownloadPackage,
} from '../../../components/UpdateReminder/hooks';
import { useHelpLink } from '../../../hooks/useHelpLink';

const STEP_INDEX_MAP: Record<EAppUpdateStatus, number> = {
  [EAppUpdateStatus.failed]: -2,
  [EAppUpdateStatus.done]: -2,
  [EAppUpdateStatus.notify]: -1,
  [EAppUpdateStatus.downloadPackage]: 0,
  [EAppUpdateStatus.downloadPackageFailed]: 0,
  [EAppUpdateStatus.downloadASC]: 1,
  [EAppUpdateStatus.downloadASCFailed]: 1,
  [EAppUpdateStatus.verifyASC]: 2,
  [EAppUpdateStatus.verifyASCFailed]: 2,
  [EAppUpdateStatus.verifyPackage]: 3,
  [EAppUpdateStatus.verifyPackageFailed]: 3,
  [EAppUpdateStatus.ready]: 4,
  [EAppUpdateStatus.updateIncomplete]: 6,
  [EAppUpdateStatus.manualInstall]: 6,
};

const checkIsError = (status: EAppUpdateStatus) =>
  [
    EAppUpdateStatus.downloadPackageFailed,
    EAppUpdateStatus.downloadASCFailed,
    EAppUpdateStatus.verifyASCFailed,
    EAppUpdateStatus.verifyPackageFailed,
  ].includes(status);

function RetryButton({ onPress }: IButtonProps) {
  const intl = useIntl();
  return (
    <XStack>
      <Button onPress={onPress}>
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </XStack>
  );
}

function ContactUsButton() {
  const intl = useIntl();
  const requestsUrl = useHelpLink({ path: 'requests/new' });
  const onPress = useCallback(() => {
    openUrlExternal(requestsUrl);
  }, [requestsUrl]);
  return (
    <XStack>
      <Button onPress={onPress}>
        {intl.formatMessage({ id: ETranslations.global_contact_us })}
      </Button>
    </XStack>
  );
}

function DownloadVerify({
  route,
}: IPageScreenProps<IAppUpdatePagesParamList, EAppUpdateRoutes.UpdatePreview>) {
  const intl = useIntl();
  const { isForceUpdate } = route.params || {};
  usePreventRemove(!!isForceUpdate, () => {});
  const { data } = useAppUpdateInfo();
  const navigation = useAppNavigation();
  const {
    downloadPackage,
    downloadASC,
    verifyASC,
    verifyPackage,
    showUpdateInCompleteDialog,
  } = useDownloadPackage();

  const showInCompleteDialog = useCallback(() => {
    showUpdateInCompleteDialog({
      onCancel: () => {
        navigation.popStack();
      },
    });
  }, [navigation, showUpdateInCompleteDialog]);

  const [installing, setIsInstalling] = useState(false);

  const handleToUpdate = useCallback(async () => {
    try {
      setIsInstalling(true);
      const timer = setTimeout(() => {
        setIsInstalling(false);
      }, 3500);
      await installPackage(data);
      return () => clearTimeout(timer);
    } catch (e: unknown) {
      setIsInstalling(false);
      if ((e as { message?: string })?.message === 'NOT_FOUND_PACKAGE') {
        showInCompleteDialog();
      } else {
        Toast.error({ title: (e as Error).message });
      }
    }
  }, [data, showInCompleteDialog]);
  const stepIndex = STEP_INDEX_MAP[data.status];
  const hasError = checkIsError(data.status);

  const percent = useDownloadProgress(noop, noop);

  const renderDownloadError = useCallback(
    () => (
      <HyperlinkText
        size="$bodyLg"
        color="$textSubdued"
        translationId={
          data.errorText ===
          ETranslations.update_network_instability_check_connection
            ? data.errorText
            : ETranslations.update_retrying_fails_help_text
        }
        values={{
          reason: intl.formatMessage({
            id: data.errorText || ETranslations.global_update_failed,
          }),
        }}
      />
    ),
    [data.errorText, intl],
  );
  const fileUrl = useMemo(() => {
    if (platformEnv.isNativeAndroid) {
      return data.downloadUrl;
    }
    return data.downloadedEvent?.downloadUrl || '';
  }, [data.downloadUrl, data.downloadedEvent?.downloadUrl]);
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.update_download_and_verify_text,
        })}
      />
      <Page.Body px="$5" py="$2.5">
        <Stepper stepIndex={stepIndex} hasError={hasError}>
          <Stepper.Item
            title={intl.formatMessage({
              id: ETranslations.update_download_package_label,
            })}
            badgeText={
              Number(percent) !== 100 && Number(percent) !== 0
                ? `${percent}%`
                : undefined
            }
            renderDescription={({ status }) => {
              if (status === EStepItemStatus.Failed) {
                return renderDownloadError();
              }

              if (fileUrl) {
                return (
                  <HyperlinkText
                    size="$bodyLg"
                    color="$textSubdued"
                    translationId={ETranslations.update_download_package_desc}
                    values={{
                      file: fileUrl.split('/').pop() || '',
                    }}
                    onAction={() => {
                      openUrlExternal(
                        'https://github.com/OneKeyHQ/app-monorepo/releases',
                      );
                    }}
                  />
                );
              }
              return null;
            }}
            renderAction={({ status }) =>
              status === EStepItemStatus.Failed ? (
                <RetryButton onPress={() => downloadPackage()} />
              ) : null
            }
          />
          <Stepper.Item
            title={intl.formatMessage({
              id: ETranslations.update_download_asc_label,
            })}
            renderDescription={({ status }) => {
              if (status === EStepItemStatus.Failed) {
                return renderDownloadError();
              }
              return (
                <SizableText size="$bodyLg" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.update_download_asc_desc,
                  })}
                </SizableText>
              );
            }}
            renderAction={({ status }) =>
              status === EStepItemStatus.Failed ? (
                <RetryButton onPress={downloadASC} />
              ) : null
            }
          />
          <Stepper.Item
            title={intl.formatMessage({
              id: ETranslations.update_verify_asc_label,
            })}
            renderDescription={({ status }) => {
              if (status === EStepItemStatus.Done) {
                return (
                  <SizableText size="$bodyLg" color="$textSuccess">
                    {intl.formatMessage({
                      id: ETranslations.update_verify_asc_success_desc,
                    })}
                  </SizableText>
                );
              }
              if (status === EStepItemStatus.Failed) {
                if (
                  data.errorText ===
                  ETranslations.update_installation_package_possibly_compromised
                ) {
                  return (
                    <HyperlinkText
                      size="$bodyLg"
                      color="$textSubdued"
                      translationId={
                        ETranslations.update_retrying_fails_help_text
                      }
                      values={{
                        reason: (
                          <SizableText size="$bodyLg" color="$textSubdued">
                            {intl.formatMessage({
                              id: ETranslations.update_installation_package_possibly_compromised,
                            })}
                          </SizableText>
                        ),
                      }}
                    />
                  );
                }
                return (
                  <SizableText size="$bodyLg" color="$textCritical">
                    {intl.formatMessage({
                      id: ETranslations.update_signature_verification_failed_alert_text,
                    })}
                  </SizableText>
                );
              }
              return (
                <SizableText size="$bodyLg" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.update_verify_asc_desc,
                  })}
                </SizableText>
              );
            }}
            renderAction={({ status }) => {
              if (status === EStepItemStatus.Failed) {
                if (
                  data.errorText ===
                  ETranslations.update_installation_package_possibly_compromised
                ) {
                  return <RetryButton onPress={verifyASC} />;
                }
                return <ContactUsButton />;
              }
              return null;
            }}
          />
          <Stepper.Item
            title={intl.formatMessage({
              id: ETranslations.update_verify_package_label,
            })}
            renderDescription={({ status }) => {
              if (status === EStepItemStatus.Done) {
                return (
                  <SizableText size="$bodyLg" color="$textSuccess">
                    {intl.formatMessage({
                      id: ETranslations.update_verify_package_success_desc,
                    })}
                  </SizableText>
                );
              }
              if (status === EStepItemStatus.Failed) {
                if (
                  data.errorText ===
                  ETranslations.update_installation_package_possibly_compromised
                ) {
                  return (
                    <HyperlinkText
                      size="$bodyLg"
                      color="$textSubdued"
                      translationId={
                        ETranslations.update_retrying_fails_help_text
                      }
                      values={{
                        reason: (
                          <SizableText size="$bodyLg" color="$textSubdued">
                            {intl.formatMessage({
                              id: ETranslations.update_installation_package_possibly_compromised,
                            })}
                          </SizableText>
                        ),
                      }}
                    />
                  );
                }
                return (
                  <SizableText size="$bodyLg" color="$textCritical">
                    {intl.formatMessage({
                      id: ETranslations.update_installation_not_safe_alert_text,
                    })}
                  </SizableText>
                );
              }
              return (
                <SizableText size="$bodyLg" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.update_verify_package_desc,
                  })}
                </SizableText>
              );
            }}
            renderAction={({ status }) => {
              if (status === EStepItemStatus.Failed) {
                if (
                  data.errorText ===
                  ETranslations.update_installation_package_possibly_compromised
                ) {
                  return <RetryButton onPress={verifyPackage} />;
                }
                return <ContactUsButton />;
              }
              return null;
            }}
          />
        </Stepper>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_secure_install,
        })}
        confirmButtonProps={{
          icon:
            data.status === EAppUpdateStatus.ready
              ? 'BadgeVerifiedSolid'
              : undefined,
          disabled: data.status !== EAppUpdateStatus.ready || installing,
        }}
        onConfirm={handleToUpdate}
      />
    </Page>
  );
}

export default DownloadVerify;
