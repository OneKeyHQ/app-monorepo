import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Progress,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  removeSupportLog,
  retrySupportLog,
} from '../supportLog/supportLogJobs';

import type { ISupportLogJob } from '../supportLog/supportLogJobs';

const TONES = {
  neutral: { bg: '$bgSubdued', border: '$borderSubdued', icon: '$icon' },
  success: {
    bg: '$bgSuccessSubdued',
    border: '$borderSuccessSubdued',
    icon: '$iconSuccess',
  },
  critical: {
    bg: '$bgCriticalSubdued',
    border: '$borderCriticalSubdued',
    icon: '$iconCritical',
  },
  caution: {
    bg: '$bgCautionSubdued',
    border: '$borderCautionSubdued',
    icon: '$iconCaution',
  },
} as const;

const toMegabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

// Sits above the composer and never blocks typing or sending.
export function SupportLogStatusBar({ job }: { job: ISupportLogJob }) {
  const intl = useIntl();
  const text = (id: ETranslations) => intl.formatMessage({ id });
  const cancel = {
    label: text(ETranslations.global_cancel),
    onPress: () => removeSupportLog(job.id),
  };
  const retry = {
    label: text(ETranslations.global_retry),
    onPress: () => retrySupportLog(job.id),
  };
  let tone: keyof typeof TONES = 'neutral';
  // Without an icon the bar shows a spinner.
  let icon: IKeyOfIcons | undefined;
  let title: string;
  let description: string | undefined;
  let action: { label: string; onPress: () => void } | undefined;
  switch (job.stage) {
    case 'preparing':
      title = text(ETranslations.support_log_preparing__title);
      action = cancel;
      break;
    case 'uploading':
      title = text(ETranslations.support_log_uploading__title);
      if (job.sizeBytes && job.progressPercent !== undefined) {
        description = `${job.progressPercent}% · ${toMegabytes(
          (job.sizeBytes * job.progressPercent) / 100,
        )} / ${toMegabytes(job.sizeBytes)} MB`;
      } else if (job.sizeBytes) {
        // Routes that report no progress until the response.
        description = `${toMegabytes(job.sizeBytes)} MB`;
      }
      action = cancel;
      break;
    case 'processing':
    case 'sending':
      title = text(ETranslations.support_log_processing__title);
      description = text(ETranslations.support_log_processing__desc);
      break;
    case 'ready':
      tone = 'success';
      icon = 'CheckRadioSolid';
      title = text(ETranslations.support_log_ready__title);
      description = text(ETranslations.support_log_ready__desc);
      break;
    case 'uploadFailed':
      tone = 'critical';
      icon = 'ErrorOutline';
      title = text(ETranslations.support_log_upload_failed__title);
      description = text(ETranslations.support_log_upload_failed__desc);
      action = retry;
      break;
    case 'sendFailed':
      tone = 'critical';
      icon = 'ErrorOutline';
      title = text(ETranslations.support_log_id_not_sent__title);
      action = retry;
      break;
    case 'rateLimited':
      tone = 'caution';
      icon = 'ClockTimeHistoryOutline';
      title = text(ETranslations.support_log_rate_limited__title);
      description = text(ETranslations.support_log_rate_limited__desc);
      action = {
        label: text(ETranslations.global_close),
        onPress: () => removeSupportLog(job.id),
      };
      break;
    default:
      return null;
  }
  const colors = TONES[tone];
  return (
    <XStack
      testID="support-log-status"
      role="status"
      alignItems="center"
      gap="$3"
      py="$2.5"
      pl="$3"
      pr={action ? '$1' : '$4'}
      borderWidth={1}
      borderColor={colors.border}
      borderRadius="$4"
      bg={colors.bg}
    >
      {icon ? (
        <Icon name={icon} size="$5" color={colors.icon} />
      ) : (
        <Spinner size="small" />
      )}
      <YStack flex={1} gap="$0.5">
        <SizableText size="$bodyMdMedium">{title}</SizableText>
        {description ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {description}
          </SizableText>
        ) : null}
        {job.stage === 'uploading' && job.progressPercent !== undefined ? (
          <Progress size="small" value={job.progressPercent} mt="$1.5" />
        ) : null}
      </YStack>
      {action ? (
        <Button
          size="small"
          variant="tertiary"
          testID="support-log-status-action"
          onPress={action.onPress}
        >
          {action.label}
        </Button>
      ) : null}
    </XStack>
  );
}
