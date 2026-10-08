import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { defaultLogger } from '../logger/logger';
import platformEnv from '../platformEnv';

function convertToCSV(data: any[]) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row: { [x: string]: any }) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return '';

          const stringValue = String(value);
          if (
            stringValue.includes(',') ||
            stringValue.includes('\n') ||
            stringValue.includes('"')
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(','),
    ),
  ].join('\n');

  return csvContent;
}

// Returns true when the file was handed off to the platform (share sheet
// opened / browser download triggered), false otherwise so callers can
// surface an error to the user.
async function exportCSVExpo(
  data: any[] | string,
  filename = 'export.csv',
  skipConversion = false,
): Promise<boolean> {
  try {
    // Get CSV string
    const csvString =
      skipConversion && typeof data === 'string'
        ? data
        : convertToCSV(data as any[]);

    if (!csvString) {
      defaultLogger.app.error.log('exportCSV: no data to export');
      return false;
    }

    const fileUri = `${FileSystem.cacheDirectory ?? ''}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csvString);

    if (!(await Sharing.isAvailableAsync())) {
      // Without a share sheet the file stays in the sandboxed cache directory,
      // which the user cannot reach — treat it as a failure.
      defaultLogger.app.error.log(
        `exportCSV: sharing unavailable, file saved to: ${fileUri}`,
      );
      return false;
    }
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
    });
    return true;
  } catch (error) {
    defaultLogger.app.error.log(`exportCSV failed: ${String(error)}`);
    return false;
  }
}

function exportCSVWeb(
  data: any[] | string,
  filename = 'export.csv',
  skipConversion = false,
): boolean {
  try {
    // Get CSV string
    const csvString =
      skipConversion && typeof data === 'string'
        ? data
        : convertToCSV(data as any[]);

    if (!csvString) {
      defaultLogger.app.error.log('exportCSV: no data to export');
      return false;
    }

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    defaultLogger.app.error.log(`exportCSV failed: ${String(error)}`);
    return false;
  }
}

async function exportCSV(
  data: any[] | string,
  filename = 'export.csv',
  skipConversion = false,
): Promise<boolean> {
  if (platformEnv.isNative) {
    return exportCSVExpo(data, filename, skipConversion);
  }
  return exportCSVWeb(data, filename, skipConversion);
}

export default {
  convertToCSV,
  exportCSV,
  exportCSVWeb,
  exportCSVExpo,
};
