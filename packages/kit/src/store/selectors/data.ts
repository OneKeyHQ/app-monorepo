import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectData = (state: IAppState) => state.data;

export const selectIsPasswordSet = createSelector(
  selectData,
  (s) => s.isPasswordSet,
);

export const selectIsUnlock = createSelector(selectData, (s) => s.isUnlock);

export const selectHandOperatedLock = createSelector(
  selectData,
  (s) => s.handOperatedLock,
);

export const selectFeePresetIndexMap = createSelector(
  selectData,
  (s) => s.feePresetIndexMap,
);

export const selectTranslations = createSelector(
  selectData,
  (s) => s.translations,
);

export const selectTools = createSelector(selectData, (s) => s.tools);

export const selectIsPasswordLoadedInVault = createSelector(
  selectData,
  (s) => s.isPasswordLoadedInVault,
);

export const selectHomePageCheckBoarding = createSelector(
  selectData,
  (s) => s.homePageCheckBoarding,
);
