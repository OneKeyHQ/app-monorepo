import { useCallback, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type { IExportInviteDataParams } from '@onekeyhq/shared/src/referralCode/type';
import csvExporterUtils from '@onekeyhq/shared/src/utils/csvExporterUtils';

export function useExportInviteData() {
  const [isExporting, setIsExporting] = useState(false);
  const { format } = useFormatDate();

  const exportInviteData = useCallback(
    async (params: IExportInviteDataParams) => {
      try {
        setIsExporting(true);

        // Fetch CSV data from API (returns CSV string and filename)
        const result =
          await backgroundApiProxy.serviceReferralCode.exportInviteData(params);

        if (!result.data) {
          throw new OneKeyError('No data to export');
        }

        // Use server-provided filename, fallback to generated one
        let filename = result.filename;
        if (!filename) {
          const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
          filename = `invite_data_${params.subject}_${params.timeRange}_${timestamp}.csv`;
        }

        // Export CSV file directly (skipConversion = true)
        await csvExporterUtils.exportCSV(result.data, filename, true);

        return true;
      } catch (error) {
        console.error('Export failed:', error);
        throw error;
      } finally {
        setIsExporting(false);
      }
    },
    [format],
  );

  return {
    exportInviteData,
    isExporting,
  };
}
