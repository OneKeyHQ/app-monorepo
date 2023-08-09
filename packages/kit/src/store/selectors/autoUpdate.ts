import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectAutoUpdate = (state: IAppState) => state.autoUpdate;

export const selectAutoUpdateLatest = createSelector(
  selectAutoUpdate,
  (s) => s.latest,
);

export const selectAutoUpdateState = createSelector(
  selectAutoUpdate,
  (s) => s.state,
);

export const selectAutoUpdateProgress = createSelector(
  selectAutoUpdate,
  (s) => s.progress,
);

export const selectAutoUpdateEnabled = createSelector(
  selectAutoUpdate,
  (s) => s.enabled,
);
