import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EExportSubject,
  EExportTimeRange,
} from '@onekeyhq/shared/src/referralCode/type';

import { useExportInviteData } from '../hooks/useExportInviteData';

interface IExportButtonProps {
  subject?: EExportSubject;
  timeRange?: EExportTimeRange;
  inviteCode?: string;
}

export function ExportButton({
  subject = EExportSubject.HardwareSales,
  timeRange = EExportTimeRange.All,
  inviteCode,
}: IExportButtonProps) {
  const intl = useIntl();
  const { exportInviteData, isExporting } = useExportInviteData();

  const handleExport = useCallback(async () => {
    try {
      await exportInviteData({
        subject,
        timeRange,
        inviteCode,
      });
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });
    } catch (error) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_failed,
        }),
      });
    }
  }, [exportInviteData, intl, subject, timeRange, inviteCode]);

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
