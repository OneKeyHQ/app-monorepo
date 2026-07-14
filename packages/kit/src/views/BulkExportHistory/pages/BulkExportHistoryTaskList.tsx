import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IBadgeType } from '@onekeyhq/components';
import {
  Badge,
  Empty,
  ListView,
  Page,
  Skeleton,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import csvExporterUtils from '@onekeyhq/shared/src/utils/csvExporterUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IExportTransactionHistoryTask } from '@onekeyhq/shared/types/history';

import {
  PageFrame,
  isErrorState,
  isLoadingState,
} from '../../Staking/components/PageFrame';
import BulkExportHistoryNetworkAvatars from '../components/BulkExportHistoryNetworkAvatars';

const TASK_POLLING_INTERVAL_MS = timerUtils.getTimeDurationMs({ seconds: 5 });

function TaskListSkeleton() {
  return (
    <Stack>
      {Array.from({ length: 3 }).map((_, index) => (
        <ListItem key={index}>
          <Skeleton h="$8" w="$8" radius="round" />
          <Stack gap="$1">
            <Skeleton.BodyLg />
            <Skeleton.BodyMd />
          </Stack>
        </ListItem>
      ))}
    </Stack>
  );
}

function ExportTaskListItem({ task }: { task: IExportTransactionHistoryTask }) {
  const intl = useIntl();

  const networkIds = useMemo(
    () => Object.keys(task.query?.networkIdToAddressArray ?? {}),
    [task.query?.networkIdToAddressArray],
  );

  const dateRangeText = useMemo(() => {
    const formatDay = (timestampMs: number) =>
      formatDate(new Date(timestampMs), { hideTimeForever: true });
    return `${formatDay(task.query.minTimestampMs)} - ${formatDay(
      task.query.maxTimestampMs,
    )}`;
  }, [task.query.maxTimestampMs, task.query.minTimestampMs]);

  const subtitle = useMemo(() => {
    if (task.status === 'success') {
      // a non-null `next` means the export hit the limit and is partial
      const partialSuffix =
        task.next === null || task.next === undefined ? '' : ' · Partial';
      return `${task.count} transactions${partialSuffix}`;
    }
    if (task.status === 'failed' && task.message && task.message !== 'ok') {
      return task.message;
    }
    return formatDate(new Date(task.createdAt), { hideSeconds: true });
  }, [task.count, task.createdAt, task.message, task.next, task.status]);

  const { badgeType, statusLabel } = useMemo((): {
    badgeType: IBadgeType;
    statusLabel: string;
  } => {
    switch (task.status) {
      case 'pending':
        return {
          badgeType: 'info',
          statusLabel: intl.formatMessage({ id: ETranslations.global_pending }),
        };
      case 'processing':
        return {
          badgeType: 'info',
          statusLabel: intl.formatMessage({
            id: ETranslations.global_processing,
          }),
        };
      case 'success':
        return {
          badgeType: 'success',
          statusLabel: intl.formatMessage({ id: ETranslations.global_success }),
        };
      case 'failed':
        return {
          badgeType: 'critical',
          statusLabel: intl.formatMessage({ id: ETranslations.global_failed }),
        };
      case 'deprecated':
        return {
          badgeType: 'default',
          statusLabel: 'Expired',
        };
      default:
        return {
          badgeType: 'default',
          statusLabel: task.status,
        };
    }
  }, [intl, task.status]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (isDownloading) {
      return;
    }
    setIsDownloading(true);
    try {
      const csvData =
        await backgroundApiProxy.serviceHistory.downloadExportTransactionHistoryTaskCsv(
          { id: task.id },
        );

      const formatFilenameDay = (timestampMs: number) =>
        formatDate(new Date(timestampMs), { formatTemplate: 'ddMMyy' });
      const filename = `transaction_history_${formatFilenameDay(
        task.query.minTimestampMs,
      )}_${formatFilenameDay(task.query.maxTimestampMs)}.csv`;

      const saved = await csvExporterUtils.exportCSV(csvData, filename, true);
      if (saved) {
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.global_success }),
        });
      } else {
        Toast.error({
          title: 'Download failed, please try again.',
        });
      }
    } catch (error) {
      // The api client interceptor already toasts the server error message,
      // so only log here to avoid duplicate toasts.
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  }, [
    intl,
    isDownloading,
    task.id,
    task.query.maxTimestampMs,
    task.query.minTimestampMs,
  ]);

  return (
    <ListItem
      renderAvatar={<BulkExportHistoryNetworkAvatars networkIds={networkIds} />}
      title={dateRangeText}
      subtitle={subtitle}
      subtitleProps={{ numberOfLines: 1 }}
    >
      <XStack alignItems="center" gap="$3">
        <Badge badgeType={badgeType} badgeSize="sm">
          <Badge.Text>{statusLabel}</Badge.Text>
        </Badge>
        {task.status === 'success' ? (
          <ListItem.IconButton
            testID={`bulk-export-history-task-download-${task.id}`}
            icon="DownloadOutline"
            loading={isDownloading}
            onPress={handleDownload}
          />
        ) : null}
      </XStack>
    </ListItem>
  );
}

function BulkExportHistoryTaskList() {
  const intl = useIntl();

  const { result, isLoading, run } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceHistory.fetchExportTransactionHistoryTasks(),
    [],
    { watchLoading: true },
  );

  const tasks = useMemo(
    () =>
      [...(result?.list ?? [])].toSorted((a, b) => b.createdAt - a.createdAt),
    [result],
  );

  const hasInProgressTask = useMemo(
    () =>
      tasks.some(
        (task) => task.status === 'pending' || task.status === 'processing',
      ),
    [tasks],
  );

  useEffect(() => {
    if (!hasInProgressTask) {
      return undefined;
    }
    const timer = setInterval(() => {
      // ignore transient polling errors; the current list stays visible
      void run().catch(() => undefined);
    }, TASK_POLLING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasInProgressTask, run]);

  return (
    <Page>
      <Page.Header title="Export history" />
      <Page.Body>
        <PageFrame
          LoadingSkeleton={TaskListSkeleton}
          loading={isLoadingState({ result, isLoading })}
          error={isErrorState({ result, isLoading })}
          onRefresh={run}
        >
          <ListView
            data={tasks}
            estimatedItemSize="$16"
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <ExportTaskListItem task={item} />}
            ListEmptyComponent={
              <Empty
                icon="ClockTimeHistoryOutline"
                title={intl.formatMessage({ id: ETranslations.global_no_data })}
              />
            }
          />
        </PageFrame>
      </Page.Body>
    </Page>
  );
}

export default BulkExportHistoryTaskList;
