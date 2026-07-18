import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Button,
  Empty,
  Page,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { DescriptionItem } from '@onekeyhq/kit/src/components/DescriptionItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalBulkExportHistoryRoutes,
  type IModalBulkExportHistoryParamList,
} from '@onekeyhq/shared/src/routes/bulkExportHistory';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../Staking/components/PageFrame';
import BulkExportHistoryDownloadButton from '../components/BulkExportHistoryDownloadButton';
import BulkExportHistoryNetworkAvatars from '../components/BulkExportHistoryNetworkAvatars';
import {
  useBulkExportHistoryTaskPolling,
  useBulkExportHistoryTasks,
} from '../hooks/useBulkExportHistoryTasks';
import { isBulkExportHistoryMockTaskId } from '../utils/bulkExportHistoryTaskMocks';

import BulkExportHistoryTaskStatus from './BulkExportHistoryTaskStatus';
import {
  formatExportHistoryTaskDateRange,
  formatExportHistoryTaskTime,
  formatExportHistoryTaskTimeZone,
  getExportHistoryTaskNetworkIds,
  getExportHistoryTaskStatusMeta,
} from './bulkExportHistoryTaskUtils';

const TASK_DETAIL_CONTENT_MAX_WIDTH = 720;
const TASK_DETAIL_SKELETON_ROWS = [
  { labelWidth: 80, valueWidth: 152 },
  { labelWidth: 104, valueWidth: 152 },
  { labelWidth: 72, valueWidth: 96 },
  { labelWidth: 112, valueWidth: 72 },
] as const;

function TaskDetailSkeleton() {
  return (
    <YStack
      width="100%"
      maxWidth={TASK_DETAIL_CONTENT_MAX_WIDTH}
      alignSelf="center"
      px="$5"
      py="$4"
      gap="$4"
    >
      <YStack
        gap="$3"
        p="$4"
        bg="$bgSubdued"
        borderRadius="$3"
        borderCurve="continuous"
      >
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
            <Skeleton h="$7" w="$7" radius="round" flexShrink={0} />
            <Skeleton.BodyMd w={112} />
          </XStack>
          <XStack alignItems="center" gap="$1.5" flexShrink={0}>
            <Skeleton h="$1.5" w="$1.5" radius="round" />
            <Skeleton.BodyMd w={56} />
          </XStack>
        </XStack>
        <Skeleton.HeadingLg width="60%" />
        <Skeleton.BodyMd width="32%" />
      </YStack>
      <YStack bg="$bgSubdued" borderRadius="$3" p="$4" gap="$4">
        {TASK_DETAIL_SKELETON_ROWS.map(({ labelWidth, valueWidth }) => (
          <XStack
            key={labelWidth}
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
          >
            <Skeleton.BodyMd w={labelWidth} />
            <Skeleton.BodyMd w={valueWidth} />
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

function BulkExportHistoryTaskDetail({
  route,
}: IPageScreenProps<
  IModalBulkExportHistoryParamList,
  EModalBulkExportHistoryRoutes.BulkExportHistoryTaskDetail
>) {
  const intl = useIntl();
  const media = useMedia();
  const navigation = useAppNavigation();
  const {
    taskId,
    selectedNetworkIds: fallbackSelectedNetworkIds,
    accountSelectorSceneUrl,
  } = route.params;

  const { result, isLoading, run, tasks } = useBulkExportHistoryTasks();
  const task = useMemo(
    () =>
      result ? (tasks.find((item) => item.id === taskId) ?? null) : undefined,
    [result, taskId, tasks],
  );

  const statusMeta = useMemo(
    () => (task ? getExportHistoryTaskStatusMeta(task) : undefined),
    [task],
  );
  const isMockTask = Boolean(task && isBulkExportHistoryMockTaskId(task.id));

  useBulkExportHistoryTaskPolling({
    enabled: Boolean(statusMeta?.isInProgress && !isMockTask),
    isLoading,
    run,
  });

  const statusLabel = statusMeta
    ? intl.formatMessage({ id: statusMeta.labelId })
    : '';
  const statusDescription = statusMeta?.descriptionId
    ? intl.formatMessage({ id: statusMeta.descriptionId })
    : undefined;

  const networkIds = useMemo(
    () =>
      task
        ? getExportHistoryTaskNetworkIds(task)
        : (fallbackSelectedNetworkIds ?? []),
    [fallbackSelectedNetworkIds, task],
  );
  const canStartNewExport = Boolean(
    accountSelectorSceneUrl &&
    (statusMeta?.displayStatus === 'failed' ||
      statusMeta?.displayStatus === 'expired'),
  );
  const handleStartNewExport = useCallback(() => {
    navigation.push(EModalBulkExportHistoryRoutes.BulkExportHistoryModal, {
      networkId: networkIds[0],
      selectedNetworkIds: networkIds,
      accountSelectorSceneUrl,
    });
  }, [accountSelectorSceneUrl, navigation, networkIds]);
  const dateRangeText = task ? formatExportHistoryTaskDateRange(task) : '';
  const createdAtText = task ? formatExportHistoryTaskTime(task.createdAt) : '';
  const shouldShowLastUpdated = Boolean(
    task && task.updatedAt > task.createdAt,
  );
  const lastUpdatedText = task
    ? formatExportHistoryTaskTime(task.updatedAt)
    : '';
  const timeZoneText = task
    ? (formatExportHistoryTaskTimeZone(task.query.timeZone) ??
      intl.formatMessage({ id: ETranslations.global_not_available }))
    : '';
  let riskFilterText = '';
  if (task) {
    if (task.query.onlySafe === undefined) {
      riskFilterText = intl.formatMessage({
        id: ETranslations.global_not_available,
      });
    } else {
      const riskFilterMessageId = task.query.onlySafe
        ? ETranslations.global_enabled
        : ETranslations.global_disabled;
      riskFilterText = intl.formatMessage({ id: riskFilterMessageId });
    }
  }
  const transactionCountText =
    task && statusMeta?.isDownloadable
      ? intl.formatMessage(
          {
            id: ETranslations.export_history_transactions_count__desc,
          },
          { count: task.count },
        )
      : undefined;

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.export_history_details__title,
        })}
      />
      <Page.Body testID="bulk-export-history-task-detail-body">
        <PageFrame
          LoadingSkeleton={TaskDetailSkeleton}
          loading={isLoadingState({ result, isLoading })}
          error={isErrorState({ result, isLoading })}
          onRefresh={run}
        >
          {task && statusMeta ? (
            <YStack
              width="100%"
              maxWidth={TASK_DETAIL_CONTENT_MAX_WIDTH}
              alignSelf="center"
              px="$5"
              py="$4"
              gap="$4"
            >
              <YStack
                gap="$3"
                p="$4"
                bg="$bgSubdued"
                borderRadius="$3"
                borderCurve="continuous"
              >
                <XStack
                  alignItems="center"
                  justifyContent="space-between"
                  gap="$3"
                >
                  <BulkExportHistoryNetworkAvatars
                    networkIds={networkIds}
                    showNames
                    showAllNames
                  />
                  <BulkExportHistoryTaskStatus
                    label={statusLabel}
                    statusMeta={statusMeta}
                  />
                </XStack>
                <SizableText size="$headingLg">{dateRangeText}</SizableText>
                {transactionCountText ? (
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {transactionCountText}
                  </SizableText>
                ) : null}
                {statusDescription ? (
                  <SizableText
                    size="$bodyMd"
                    color={statusMeta.descriptionColor}
                  >
                    {statusDescription}
                  </SizableText>
                ) : null}
              </YStack>

              <YStack bg="$bgSubdued" borderRadius="$3" p="$4" gap="$4">
                <DescriptionItem
                  label={intl.formatMessage({
                    id: ETranslations.export_history_created__title,
                  })}
                  value={createdAtText}
                />
                {shouldShowLastUpdated ? (
                  <DescriptionItem
                    label={intl.formatMessage({
                      id: ETranslations.export_history_last_updated__title,
                    })}
                    value={lastUpdatedText}
                  />
                ) : null}
                <DescriptionItem
                  label={intl.formatMessage({
                    id: ETranslations.export_history_time_zone__title,
                  })}
                  value={timeZoneText}
                />
                <DescriptionItem
                  label={intl.formatMessage({
                    id: ETranslations.exclude_risky_transactions__action,
                  })}
                  value={riskFilterText}
                />
                {statusMeta.displayStatus === 'partial' ? (
                  <DescriptionItem
                    label={intl.formatMessage({
                      id: ETranslations.export_history_transaction_limit__title,
                    })}
                    value={intl.formatMessage(
                      {
                        id: ETranslations.export_history_transactions_count__desc,
                      },
                      { count: task.query.limit },
                    )}
                  />
                ) : null}
              </YStack>
            </YStack>
          ) : null}
          {task === null ? (
            <Empty
              pt="$24"
              icon="ClockTimeHistoryOutline"
              title={intl.formatMessage({
                id: ETranslations.global_not_available,
              })}
              description={intl.formatMessage({
                id: ETranslations.export_history_expired__desc,
              })}
              buttonProps={
                accountSelectorSceneUrl && networkIds.length
                  ? {
                      variant: 'secondary',
                      onPress: handleStartNewExport,
                      children: intl.formatMessage({
                        id: ETranslations.start_new_export__action,
                      }),
                    }
                  : undefined
              }
            />
          ) : null}
        </PageFrame>
      </Page.Body>
      {task && (statusMeta?.isDownloadable || canStartNewExport) ? (
        <Page.Footer>
          <XStack
            width="100%"
            maxWidth={TASK_DETAIL_CONTENT_MAX_WIDTH}
            alignSelf="center"
            px="$5"
            py="$4"
            bg="$bgApp"
            justifyContent={media.gtMd ? 'flex-end' : undefined}
          >
            {statusMeta?.isDownloadable ? (
              <BulkExportHistoryDownloadButton
                task={task}
                width={media.gtMd ? undefined : '100%'}
                size={media.gtMd ? 'medium' : 'large'}
                testID={`bulk-export-history-task-detail-download-${task.id}`}
              />
            ) : (
              <Button
                variant="secondary"
                width={media.gtMd ? undefined : '100%'}
                size={media.gtMd ? 'medium' : 'large'}
                testID={`bulk-export-history-task-detail-new-export-${task.id}`}
                onPress={handleStartNewExport}
              >
                {intl.formatMessage({
                  id: ETranslations.start_new_export__action,
                })}
              </Button>
            )}
          </XStack>
        </Page.Footer>
      ) : null}
    </Page>
  );
}

export default BulkExportHistoryTaskDetail;
