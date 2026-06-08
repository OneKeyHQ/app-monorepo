// Pure predicates over EUpdateStrategy / EAppUpdateStatus. Extracted into
// their own file (rather than living in useAppUpdate.tsx) because both
// useAppUpdate.tsx and AppUpdateForeground.tsx need them, and putting them
// in either of those files creates a require cycle:
//
//   useAppUpdate.tsx → AppUpdateForeground.tsx (useAppUpdateForegroundEffects)
//   AppUpdateForeground.tsx → useAppUpdate.tsx (the predicates)
//
// Pulling the leaves down here breaks the cycle without changing any
// public API: useAppUpdate.tsx re-exports these for callers that
// previously imported them by name.

import {
  EAppUpdateStatus,
  EUpdateFileType,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';

/** Returns true when the strategy means "no user-visible toast on failure". */
export const isShowToastError = (updateStrategy: EUpdateStrategy) => {
  return (
    updateStrategy !== EUpdateStrategy.silent &&
    updateStrategy !== EUpdateStrategy.seamless
  );
};

/** Strategies that auto-download in the background without confirming. */
export const isAutoUpdateStrategy = (updateStrategy: EUpdateStrategy) => {
  return (
    updateStrategy === EUpdateStrategy.silent ||
    updateStrategy === EUpdateStrategy.seamless
  );
};

/**
 * Whether the update-in-progress UI surface should be visible. seamless
 * is always invisible; manual / force are always visible; silent only
 * surfaces when status reaches `ready` (i.e. the install prompt).
 */
export const isShowAppUpdateUIWhenUpdating = ({
  updateStrategy,
  updateStatus,
}: {
  updateStrategy: EUpdateStrategy;
  updateStatus: EAppUpdateStatus;
}) => {
  if (updateStrategy === EUpdateStrategy.seamless) {
    return false;
  }
  if (
    updateStrategy === EUpdateStrategy.manual ||
    updateStrategy === EUpdateStrategy.force
  ) {
    return true;
  }
  return updateStatus === EAppUpdateStatus.ready;
};

export const isForceUpdateStrategy = (updateStrategy: EUpdateStrategy) => {
  return updateStrategy === EUpdateStrategy.force;
};

/**
 * Label for the toolbox update reminder's action button. A downloaded hot
 * update (jsBundle at `ready`) applies by restarting on click, so it reads
 * "Update now"; every other state opens a flow (changelog / download-verify)
 * and keeps the generic "View".
 */
export const getUpdateReminderActionLabelId = ({
  fileType,
  updateStatus,
}: {
  fileType: EUpdateFileType;
  updateStatus: EAppUpdateStatus;
}): ETranslations =>
  fileType === EUpdateFileType.jsBundle &&
  updateStatus === EAppUpdateStatus.ready
    ? ETranslations.update_update_now
    : ETranslations.global_view;

/**
 * Desktop surfaces a dedicated "Update" button in the header for hot updates,
 * so the in-toolbox indicators (the Action Center reminder bar AND the
 * more-actions dot, which would otherwise open an empty Action Center) are
 * duplicates. Treat the desktop + jsBundle combination as redundant and hide
 * both. Native has no header button, so they remain the only affordance.
 */
export const isToolboxUpdateIndicatorRedundant = ({
  isDesktop,
  fileType,
}: {
  isDesktop: boolean;
  fileType: EUpdateFileType;
}): boolean => isDesktop && fileType === EUpdateFileType.jsBundle;
