export type IPrimeAddressRiskCheckEntryPoint =
  | 'inputManual'
  | 'inputRecentList'
  | 'historyList';

export type IExportHistoryRangeType = 'lastMonth' | 'last3Months' | 'custom';

export type IExportHistoryAccountType = 'indexed' | 'watching' | 'imported';

export type IExportHistoryDownloadEntryPoint = 'taskList' | 'taskDetail';
