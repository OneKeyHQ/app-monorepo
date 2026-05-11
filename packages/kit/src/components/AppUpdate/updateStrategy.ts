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
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';

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
