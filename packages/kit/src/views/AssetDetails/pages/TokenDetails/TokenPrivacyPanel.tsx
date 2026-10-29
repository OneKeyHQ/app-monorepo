import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Button,
  type IIconProps,
  Icon,
  Progress,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type ITokenPrivacyPanelState =
  | 'disabled'
  | 'preparing'
  | 'syncing'
  | 'synced'
  | 'stopped'
  | 'error';

export type ITokenPrivacyPanelProps = {
  state: ITokenPrivacyPanelState;
  title?: string;
  description?: string;
  detail?: string;
  updatedAtLabel?: string;
  progress?: number;
  busy?: boolean;
  enableUnavailable?: boolean;
  actionLabel?: string;
  onEnable?: () => void;
  onStop?: () => void;
  onSync?: () => void;
};

const STATUS_LABELS: Record<ITokenPrivacyPanelState, ETranslations> = {
  disabled: ETranslations.privacy_enable__title,
  preparing: ETranslations.global_preparing,
  syncing: ETranslations.global_syncing,
  synced: ETranslations.global_synced,
  stopped: ETranslations.syncing_paused__title,
  error: ETranslations.global_sync_error,
};

const ACTION_LABELS: Record<
  Exclude<ITokenPrivacyPanelState, 'preparing'>,
  ETranslations
> = {
  disabled: ETranslations.global_enable,
  syncing: ETranslations.global_pause,
  synced: ETranslations.global_refresh,
  stopped: ETranslations.global_resume,
  error: ETranslations.global_retry,
};

export function TokenPrivacyPanel({
  state,
  title,
  description,
  detail,
  updatedAtLabel,
  progress,
  busy = false,
  enableUnavailable = false,
  actionLabel,
  onEnable,
  onStop,
  onSync,
}: ITokenPrivacyPanelProps) {
  const intl = useIntl();
  const reducedMotion = useReducedMotion();
  const isDisabled = state === 'disabled';
  const isPreparing = state === 'preparing';
  const isSyncing = state === 'syncing';
  const isError = state === 'error';
  const isSynced = state === 'synced';
  let onAction = onSync;
  if (isDisabled) {
    onAction = onEnable;
  } else if (isSyncing) {
    onAction = onStop;
  }
  let statusIcon: IIconProps['name'] = 'PauseOutline';
  let statusColor: IIconProps['color'] = '$iconSubdued';
  if (isDisabled) {
    statusIcon = 'ShieldOutline';
  } else if (isPreparing || isSyncing) {
    statusIcon = 'RefreshCwOutline';
  } else if (isError) {
    statusIcon = 'ErrorOutline';
    statusColor = '$iconCritical';
  } else if (isSynced) {
    statusIcon = 'ShieldCheckDoneOutline';
    statusColor = '$iconSuccess';
  }
  const progressValue =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.min(100, Math.max(0, progress))
      : undefined;
  const showProgress =
    (isSyncing || state === 'stopped') && progressValue !== undefined;
  let supportingText = description;
  if (supportingText === undefined) {
    if (isDisabled) {
      supportingText = intl.formatMessage({
        id: ETranslations.privacy_enable__desc,
      });
    }
  }
  const action =
    state !== 'preparing' && onAction && !(isDisabled && enableUnavailable) ? (
      <Button
        testID="token-privacy-action"
        alignSelf={isDisabled ? 'flex-start' : 'center'}
        m={0}
        mt={isDisabled ? '$3' : undefined}
        flexShrink={0}
        size="small"
        variant={isDisabled ? 'primary' : 'tertiary'}
        loading={busy}
        disabled={busy}
        onPress={onAction}
      >
        {actionLabel ?? intl.formatMessage({ id: ACTION_LABELS[state] })}
      </Button>
    ) : null;

  return (
    <YStack
      testID="token-privacy-panel"
      bg="$bgSubdued"
      borderRadius="$3"
      p="$4"
      gap="$3"
    >
      <XStack
        alignItems={isDisabled ? 'flex-start' : 'center'}
        gap="$3"
        minHeight="$8"
      >
        <Stack
          width={isDisabled ? '$10' : '$5'}
          height={isDisabled ? '$10' : '$5'}
          bg={isDisabled ? '$bgStrong' : undefined}
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {(isPreparing || isSyncing) && !reducedMotion ? (
            <Spinner size="small" color={statusColor} />
          ) : (
            <Icon
              name={statusIcon}
              size={isDisabled ? '$6' : '$5'}
              color={statusColor}
            />
          )}
        </Stack>
        <YStack flex={1} minWidth={0} gap="$1">
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <SizableText
              testID="token-privacy-status"
              size="$bodyMdMedium"
              color="$text"
              flexShrink={1}
            >
              {title ?? intl.formatMessage({ id: STATUS_LABELS[state] })}
            </SizableText>
          </XStack>
          {supportingText ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {supportingText}
            </SizableText>
          ) : null}
          {detail ? (
            <SizableText
              testID="token-privacy-detail"
              size="$bodySm"
              color="$textSubdued"
            >
              {detail}
            </SizableText>
          ) : null}
          {updatedAtLabel && !isDisabled && !isPreparing ? (
            <SizableText
              testID="token-privacy-updated-at"
              size="$bodySm"
              color="$textSubdued"
            >
              {updatedAtLabel}
            </SizableText>
          ) : null}
          {isDisabled ? action : null}
        </YStack>
        {!isDisabled ? (
          <XStack alignItems="center" gap="$2" flexShrink={0}>
            {showProgress && progressValue !== undefined ? (
              <SizableText
                size="$bodySmMedium"
                color="$textSubdued"
                fontVariant={['tabular-nums']}
              >
                {intl.formatNumber(progressValue / 100, {
                  style: 'percent',
                  maximumFractionDigits: 1,
                })}
              </SizableText>
            ) : null}
            {action}
          </XStack>
        ) : null}
      </XStack>
      {showProgress ? (
        <Progress
          testID="token-privacy-sync-progress"
          accessibilityLabel={intl.formatMessage({
            id: ETranslations.global_syncing,
          })}
          size="small"
          value={progressValue}
          animated={!reducedMotion}
          progressColor="$borderSubdued"
          indicatorColor={state === 'stopped' ? '$iconDisabled' : '$text'}
        />
      ) : null}
    </YStack>
  );
}
