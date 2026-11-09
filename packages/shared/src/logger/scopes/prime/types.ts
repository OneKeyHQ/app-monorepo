export type IPrimeAddressRiskCheckEntryPoint =
  | 'inputManual'
  | 'inputRecentList'
  | 'historyList'
  | 'sendAddressInput';

export type IExportHistoryRangeType = 'lastMonth' | 'last3Months' | 'custom';

export type IExportHistoryAccountType = 'indexed' | 'watching' | 'imported';

export type IExportHistoryDownloadEntryPoint = 'taskList' | 'taskDetail';

// Which entitlement let the user run a Prime feature.
export type IPrimeEntitlementSource = 'prime' | 'freeTrial';

export type IPrimeFreeTrialLoginResult = 'success' | 'cancelled' | 'failed';

// active: the user tapped an entry with no quota left; auto: a running
// session (e.g. page translation) hit the limit.
export type IPrimeFreeTrialExhaustedTrigger = 'active' | 'auto';
