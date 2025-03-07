import { useCallback, useMemo } from 'react';

import { UNSTABLE_usePreventRemove as usePreventRemove } from '@react-navigation/core';
import noop from 'lodash/noop';
import { useIntl } from 'react-intl';

import type { IButtonProps, IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  EStepItemStatus,
  Page,
  SizableText,
  Stepper,
  XStack,
  YStack,
} from '@onekeyhq/components';
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

import {
  useAppUpdateInfo,
  useDownloadPackage,
} from '../../../components/UpdateReminder/hooks';

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
  [EAppUpdateStatus.updateIncomplete]: 4,
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
    <Button onPress={onPress}>
      {intl.formatMessage({ id: ETranslations.global_retry })}
    </Button>
  );
}

function DownloadVerify({
  route,
}: IPageScreenProps<IAppUpdatePagesParamList, EAppUpdateRoutes.UpdatePreview>) {
  const intl = useIntl();
  const { isForceUpdate } = route.params || {};
  usePreventRemove(!!isForceUpdate, () => {});
  const { data } = useAppUpdateInfo();
  const handleToUpdate = useCallback(async () => {
    await installPackage(data);
  }, [data]);
  console.log('---data', data);
  const stepIndex = STEP_INDEX_MAP[data.status];
  const isError = checkIsError(data.status);

  const { downloadPackage, downloadASC, verifyASC, verifyPackage } =
    useDownloadPackage();
  const percent = useDownloadProgress(noop, noop);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.update_download_and_verify_text,
        })}
      />
      <Page.Body px="$5" py="$2.5">
        <Stepper stepIndex={stepIndex} isError={isError}>
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
                return (
                  <SizableText size="$bodyLg" color="$textSubdued">
                    Server error. If retrying fails, download the installation
                    package from OneKey's official GitHub releases page—it will
                    automatically replace the current version.
                  </SizableText>
                );
              }

              if (data.downloadedEvent?.downloadUrl) {
                return (
                  <SizableText size="$bodyLg" color="$textSubdued">
                    {intl.formatMessage(
                      { id: ETranslations.global_from_provider },
                      {
                        provider: (
                          <SizableText
                            size="$bodyLg"
                            color="$textSubdued"
                            textDecorationLine="underline"
                            cursor="pointer"
                            onPress={
                              data.downloadedEvent?.downloadUrl
                                ? () =>
                                    openUrlExternal(
                                      data.downloadedEvent?.downloadUrl || '',
                                    )
                                : undefined
                            }
                          >
                            {data.downloadedEvent?.downloadUrl}
                          </SizableText>
                        ),
                      },
                    )}
                  </SizableText>
                );
              }

              return null;
            }}
            renderAction={({ status }) =>
              status === EStepItemStatus.Failed ? (
                <RetryButton onPress={() => downloadPackage(data)} />
              ) : null
            }
          />
          <Stepper.Item
            title={intl.formatMessage({
              id: ETranslations.update_download_asc_label,
            })}
            description={intl.formatMessage({
              id: ETranslations.update_download_asc_desc,
            })}
            renderAction={({ status }) =>
              status === EStepItemStatus.Failed ? (
                <RetryButton onPress={downloadASC} />
              ) : null
            }
          />
          <Stepper.Item
            title={intl.formatMessage({
              id: ETranslations.update_verify_asc_labe,
            })}
            renderDescription={({ status }) =>
              status === EStepItemStatus.Done ? (
                <SizableText size="$bodyLg" color="$textSuccess">
                  {intl.formatMessage({
                    id: ETranslations.update_verify_asc_success_desc,
                  })}
                </SizableText>
              ) : (
                <SizableText size="$bodyLg" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.update_verify_asc_desc,
                  })}
                </SizableText>
              )
            }
            renderAction={({ status }) =>
              status === EStepItemStatus.Failed ? (
                <RetryButton onPress={verifyASC} />
              ) : null
            }
          />
          <Stepper.Item
            title={intl.formatMessage({
              id: ETranslations.update_verify_package_label,
            })}
            renderDescription={({ status }) =>
              status === EStepItemStatus.Done ? (
                <SizableText size="$bodyLg" color="$textSuccess">
                  {intl.formatMessage({
                    id: ETranslations.update_verify_package_success_desc,
                  })}
                </SizableText>
              ) : (
                <SizableText size="$bodyLg" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.update_verify_package_desc,
                  })}
                </SizableText>
              )
            }
            renderAction={({ status }) =>
              status === EStepItemStatus.Failed ? (
                <RetryButton onPress={verifyPackage} />
              ) : null
            }
          />
        </Stepper>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_install,
        })}
        onConfirm={handleToUpdate}
      />
    </Page>
  );
}

export default DownloadVerify;
