import { useIntl } from 'react-intl';

import type { IIconProps } from '@onekeyhq/components';
import {
  Divider,
  Icon,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EUpdateErrorCode,
  isRetryableUpdateError,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';
import type { IUpdateProgressUpdate } from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';
type IReceiptState = 'pending' | 'processing' | 'done' | 'failed';

function ReceiptRow({
  label,
  result,
  state,
  reducedMotion,
}: {
  label: string;
  result?: string;
  state: IReceiptState;
  reducedMotion: boolean;
}) {
  const intl = useIntl();
  const statusLabel = intl.formatMessage({
    id: {
      pending: ETranslations.global_pending,
      processing: ETranslations.global_processing,
      done: ETranslations.global_done,
      failed: ETranslations.global_failed,
    }[state],
  });
  let iconName: IIconProps['name'] = 'CirclePlaceholderOnOutline';
  let iconColor: IIconProps['color'] = '$iconDisabled';
  if (state === 'done') {
    iconName = 'CheckRadioSolid';
    iconColor = '$iconSuccess';
  } else if (state === 'failed') {
    iconName = 'XCircleSolid';
    iconColor = '$iconCritical';
  }
  return (
    <XStack py="$3" alignItems="center" gap="$3">
      <SizableText
        size="$bodyMd"
        flex={1}
        color={state === 'pending' ? '$textDisabled' : '$textSubdued'}
      >
        {label}
      </SizableText>
      {result ? (
        <SizableText
          size="$bodyMd"
          color={state === 'failed' ? '$textCritical' : '$text'}
          textAlign="right"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {result}
        </SizableText>
      ) : null}
      <XStack
        width={20}
        height={20}
        alignItems="center"
        justifyContent="center"
        role="img"
        aria-label={statusLabel}
      >
        {state === 'processing' && !reducedMotion ? (
          <Spinner size="small" color="$iconSubdued" />
        ) : (
          <Icon name={iconName} size="$4" color={iconColor} />
        )}
      </XStack>
    </XStack>
  );
}

export function UpdateVerifyReceipt({
  data,
  progress,
  reducedMotion,
}: {
  data: IAppUpdateInfo;
  progress: Pick<IUpdateProgressUpdate, 'percent' | 'total' | 'transferred'>;
  reducedMotion: boolean;
}) {
  const intl = useIntl();
  const status = data.status;
  const integrityFailed =
    data.updateError?.code === EUpdateErrorCode.integrityFailed ||
    data.updateError?.code === EUpdateErrorCode.securityRejected;
  const downloadFailed =
    status === EAppUpdateStatus.downloadPackageFailed ||
    (integrityFailed && data.updateError?.step === 'download');
  const signatureFailed =
    integrityFailed && data.updateError?.step === 'verifyASC';
  const contentFailed =
    integrityFailed &&
    (data.updateError?.step === 'verifyPackage' ||
      data.updateError?.step === 'install');
  const postVerificationFailed =
    !integrityFailed &&
    (data.updateError?.code === EUpdateErrorCode.installLocation ||
      data.updateError?.step === 'install');
  const retrying =
    !data.downloadRetryExhausted &&
    Boolean(data.updateError && isRetryableUpdateError(data.updateError));
  const downloaded =
    [
      EAppUpdateStatus.downloadASC,
      EAppUpdateStatus.downloadASCFailed,
      EAppUpdateStatus.verifyASC,
      EAppUpdateStatus.verifyASCFailed,
      EAppUpdateStatus.verifyPackage,
      EAppUpdateStatus.verifyPackageFailed,
      EAppUpdateStatus.ready,
    ].includes(status) ||
    postVerificationFailed ||
    signatureFailed ||
    contentFailed;
  const signed =
    [
      EAppUpdateStatus.verifyPackage,
      EAppUpdateStatus.verifyPackageFailed,
      EAppUpdateStatus.ready,
    ].includes(status) ||
    postVerificationFailed ||
    contentFailed;
  let downloadState: IReceiptState = 'pending';
  if (downloadFailed) {
    downloadState = !retrying || integrityFailed ? 'failed' : 'processing';
  } else if (status === EAppUpdateStatus.downloadPackage) {
    downloadState = 'processing';
  } else if (downloaded) {
    downloadState = 'done';
  }
  let signatureState: IReceiptState = 'pending';
  if (signatureFailed) {
    signatureState = 'failed';
  } else if (
    status === EAppUpdateStatus.downloadASC ||
    status === EAppUpdateStatus.verifyASC ||
    (retrying &&
      (status === EAppUpdateStatus.downloadASCFailed ||
        status === EAppUpdateStatus.verifyASCFailed))
  ) {
    signatureState = 'processing';
  } else if (signed) {
    signatureState = 'done';
  }
  let contentState: IReceiptState = 'pending';
  if (contentFailed) {
    contentState = 'failed';
  } else if (
    status === EAppUpdateStatus.verifyPackage ||
    (retrying && status === EAppUpdateStatus.verifyPackageFailed)
  ) {
    contentState = 'processing';
  } else if (status === EAppUpdateStatus.ready || postVerificationFailed) {
    contentState = 'done';
  }
  let totalBytes = progress.total;
  if (totalBytes <= 0 && downloadState === 'done') {
    totalBytes = data.fileSize ?? 0;
  }
  const totalMb =
    totalBytes > 0 ? Math.round(totalBytes / (1024 * 1024)) : undefined;
  const downloadedMb = Math.round(progress.transferred / (1024 * 1024));
  let downloadResult: string | undefined;
  if (status === EAppUpdateStatus.downloadPackageFailed) {
    downloadResult = intl.formatMessage({
      id: ETranslations.app_update_download_paused__msg,
    });
  } else if (downloadState === 'done' && totalMb !== undefined) {
    downloadResult = `${intl.formatNumber(totalMb)} MB`;
  } else if (downloadState === 'processing') {
    downloadResult =
      totalMb === undefined
        ? intl.formatNumber(progress.percent / 100, { style: 'percent' })
        : `${intl.formatNumber(downloadedMb)}/${intl.formatNumber(totalMb)} MB`;
  }
  let signatureResult: string | undefined;
  if (signatureState === 'done') {
    signatureResult = 'OneKey';
  } else if (signatureState === 'failed') {
    signatureResult = intl.formatMessage({ id: ETranslations.global_unknown });
  }
  let contentResult: string | undefined;
  if (contentState === 'done') {
    contentResult = intl.formatMessage({
      id: ETranslations.app_update_contents_unchanged__msg,
    });
  } else if (contentState === 'failed') {
    contentResult = intl.formatMessage({
      id: ETranslations.app_update_contents_changed__msg,
    });
  }
  return (
    <YStack>
      <ReceiptRow
        label={intl.formatMessage({ id: ETranslations.global_download })}
        state={downloadState}
        result={downloadResult}
        reducedMotion={reducedMotion}
      />
      <Divider />
      <ReceiptRow
        label={intl.formatMessage({
          id: ETranslations.app_update_signed_by__title,
        })}
        state={signatureState}
        result={signatureResult}
        reducedMotion={reducedMotion}
      />
      <Divider />
      <ReceiptRow
        label={intl.formatMessage({
          id: ETranslations.app_update_contents__title,
        })}
        state={contentState}
        result={contentResult}
        reducedMotion={reducedMotion}
      />
    </YStack>
  );
}
