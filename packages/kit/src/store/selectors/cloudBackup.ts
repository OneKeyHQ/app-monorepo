import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectCloudBackup = (state: IAppState) => state.cloudBackup;

export const selectCloudBackupIsAvailable = createSelector(
  selectCloudBackup,
  (s) => s.isAvailable,
);

export const selectCloudBackupEnabled = createSelector(
  selectCloudBackup,
  (s) => s.enabled,
);

export const selectCloudBackupInProgress = createSelector(
  selectCloudBackup,
  (s) => s.inProgress,
);

export const selectLastBackup = createSelector(
  selectCloudBackup,
  (s) => s.lastBackup,
);
