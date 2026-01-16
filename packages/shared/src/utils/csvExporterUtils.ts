import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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

async function exportCSVExpo(
  data: any[] | string,
  filename = 'export.csv',
  skipConversion = false,
) {
  try {
    // Get CSV string
    const csvString =
      skipConversion && typeof data === 'string'
        ? data
        : convertToCSV(data as any[]);

    if (!csvString) {
      console.error('no data to export');
      return;
    }

    const fileUri = `${FileSystem.cacheDirectory ?? ''}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csvString);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      console.log(`file saved to: ${fileUri}`);
    }
  } catch (error) {
    console.error('export CSV failed:', error);
  }
}

function exportCSVWeb(
  data: any[] | string,
  filename = 'export.csv',
  skipConversion = false,
) {
  try {
    // Get CSV string
    const csvString =
      skipConversion && typeof data === 'string'
        ? data
        : convertToCSV(data as any[]);

    if (!csvString) {
      console.error('no data to export');
      return;
    }

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('export CSV failed:', error);
  }
}

async function exportCSV(
  data: any[] | string,
  filename = 'export.csv',
  skipConversion = false,
) {
  if (platformEnv.isNative) {
    await exportCSVExpo(data, filename, skipConversion);
  } else {
    exportCSVWeb(data, filename, skipConversion);
  }
}

export default {
  convertToCSV,
  exportCSV,
  exportCSVWeb,
  exportCSVExpo,
};
