import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, IconButton, Toast, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EExportSubject,
  EExportTab,
  EExportTimeRange,
} from '@onekeyhq/shared/src/referralCode/type';

import { useExportInviteData } from '../hooks/useExportInviteData';

interface IExportButtonProps {
  subject?: EExportSubject;
  timeRange?: EExportTimeRange;
  inviteCode?: string;
  tab?: EExportTab;
  startTime?: number;
  endTime?: number;
}

export function ExportButton({
  subject = EExportSubject.HardwareSales,
  timeRange = EExportTimeRange.All,
  inviteCode,
  tab = EExportTab.Earn,
  startTime,
  endTime,
}: IExportButtonProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { exportInviteData, isExporting } = useExportInviteData();

  const handleExport = useCallback(async () => {
    try {
      await exportInviteData({
        subject,
        timeRange,
        inviteCode,
        tab,
        startTime,
        endTime,
      });
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });
    } catch (_error) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_failed,
        }),
      });
    }
  }, [
    exportInviteData,
    intl,
    inviteCode,
    subject,
    tab,
    timeRange,
    startTime,
    endTime,
  ]);

  if (gtMd) {
    return (
      <Button
        size="small"
        icon="DownloadOutline"
        loading={isExporting}
        onPress={handleExport}
      >
        {intl.formatMessage({ id: ETranslations.global_export })}
      </Button>
    );
  }

  return (
    <IconButton
      icon="DownloadOutline"
      variant="tertiary"
      loading={isExporting}
      onPress={handleExport}
      title={intl.formatMessage({
        id: ETranslations.global_export,
      })}
    />
  );
}
