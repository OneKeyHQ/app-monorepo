// Public API for the app-update module. Consumers previously imported
// from `@onekeyhq/kit/src/components/UpdateReminder/hooks` — those
// imports now point here.

export {
  isAutoUpdateStrategy,
  isForceUpdateStrategy,
  isShowAppUpdateUIWhenUpdating,
  getUpdateReminderActionLabelId,
  isToolboxUpdateIndicatorRedundant,
  useAppChangeLog,
  useAppUpdateInfo,
  useDownloadPackage,
  // Re-exported pure utilities (extracted from hooks.tsx so they can be
  // unit-tested independently and reused outside the React tree).
  sanitizeUpdateErrorMessage,
  extractUpdateErrorCode,
  isUnrecoverableDownloadError,
  computeDownloadRetryDelayMs,
  runDownloadWithRetry,
  buildSoftwareUpdateParams,
  getUpdatePlatform,
  asOptionalString,
  asString,
} from './useAppUpdate';

export { AppUpdateForeground } from './AppUpdateForeground';
