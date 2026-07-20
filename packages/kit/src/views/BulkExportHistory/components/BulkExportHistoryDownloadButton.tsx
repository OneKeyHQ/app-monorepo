import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type {
  IButtonProps,
  IIconButtonProps,
  IKeyOfIcons,
} from '@onekeyhq/components';
import { Button, IconButton, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IExportHistoryDownloadEntryPoint } from '@onekeyhq/shared/src/logger/scopes/prime/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import csvExporterUtils from '@onekeyhq/shared/src/utils/csvExporterUtils';
import type { IExportTransactionHistoryTask } from '@onekeyhq/shared/types/history';

import {
  formatExportHistoryTaskFilenameDay,
  getExportHistoryTaskDisplayStatus,
  getExportHistoryTaskNetworkIds,
} from '../pages/bulkExportHistoryTaskUtils';

type IBulkExportHistoryDownloadButtonProps = Omit<
  IButtonProps,
  'children' | 'icon' | 'loading' | 'onPress'
> & {
  task: IExportTransactionHistoryTask;
  entryPoint: IExportHistoryDownloadEntryPoint;
  testID: string;
};

type IBulkExportHistoryDownloadIconButtonProps = Omit<
  IIconButtonProps,
  'icon' | 'loading' | 'onPress'
> & {
  task: IExportTransactionHistoryTask;
  entryPoint: IExportHistoryDownloadEntryPoint;
  testID: string;
};

function useBulkExportHistoryDownload({
  task,
  entryPoint,
}: {
  task: IExportTransactionHistoryTask;
  entryPoint: IExportHistoryDownloadEntryPoint;
}) {
  const intl = useIntl();
  const [isDownloading, setIsDownloading] = useState(false);
  const isDownloadingRef = useRef(false);

  const actionLabel = intl.formatMessage({
    id: platformEnv.isNative
      ? ETranslations.share_csv__action
      : ETranslations.download_csv__action,
  });
  const actionIcon: IKeyOfIcons = platformEnv.isNative
    ? 'ShareOutline'
    : 'DownloadOutline';

  const handleDownload = useCallback(async () => {
    if (isDownloadingRef.current) {
      return;
    }

    isDownloadingRef.current = true;
    setIsDownloading(true);
    try {
      await errorToastUtils.withErrorAutoToast(async () => {
        const csvData =
          await backgroundApiProxy.serviceHistory.downloadExportTransactionHistoryTaskCsv(
            { id: task.id },
          );

        const formatFilenameDay = (timestampMs: number) =>
          formatExportHistoryTaskFilenameDay(timestampMs, task.query.timeZone);
        const filename = `transaction_history_${formatFilenameDay(
          task.query.minTimestampMs,
        )}_${formatFilenameDay(task.query.maxTimestampMs)}.csv`;

        const saved = await csvExporterUtils.exportCSV(csvData, filename, true);
        if (saved) {
          defaultLogger.prime.usage.exportHistoryCsvDownloadSuccess({
            entryPoint,
            networkCount: getExportHistoryTaskNetworkIds(task).length,
            transactionCount: task.count,
            isPartial: getExportHistoryTaskDisplayStatus(task) === 'partial',
          });
          Toast.success({
            title: intl.formatMessage({ id: ETranslations.global_success }),
          });
        } else {
          Toast.error({
            title: intl.formatMessage({ id: ETranslations.global_failed }),
          });
        }
      });
    } catch (error) {
      defaultLogger.app.error.log(
        `Bulk export history CSV download failed: ${String(error)}`,
      );
    } finally {
      isDownloadingRef.current = false;
      setIsDownloading(false);
    }
  }, [entryPoint, intl, task]);

  return {
    actionIcon,
    actionLabel,
    handleDownload,
    isDownloading,
  };
}

function BulkExportHistoryDownloadButton({
  task,
  entryPoint,
  testID,
  ...buttonProps
}: IBulkExportHistoryDownloadButtonProps) {
  const { actionIcon, actionLabel, handleDownload, isDownloading } =
    useBulkExportHistoryDownload({ task, entryPoint });

  return (
    <Button
      testID={testID}
      variant="secondary"
      {...buttonProps}
      icon={actionIcon}
      loading={isDownloading}
      accessibilityLabel={actionLabel}
      stopPropagation
      onPress={handleDownload}
    >
      {actionLabel}
    </Button>
  );
}

export function BulkExportHistoryDownloadIconButton({
  task,
  entryPoint,
  testID,
  ...iconButtonProps
}: IBulkExportHistoryDownloadIconButtonProps) {
  const { actionIcon, actionLabel, handleDownload, isDownloading } =
    useBulkExportHistoryDownload({ task, entryPoint });

  return (
    <IconButton
      testID={testID}
      variant="tertiary"
      {...iconButtonProps}
      icon={actionIcon}
      loading={isDownloading}
      accessibilityLabel={actionLabel}
      stopPropagation
      onPress={handleDownload}
    />
  );
}

export default BulkExportHistoryDownloadButton;
