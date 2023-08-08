import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectStatus = (state: IAppState) => state.status;

export const selectIsStatusUnlock = createSelector(
  selectStatus,
  (s) => s.isUnlock,
);

export const selectRpcStatus = createSelector(selectStatus, (s) => s.rpcStatus);

export const selectAuthenticationType = createSelector(
  selectStatus,
  (s) => s.authenticationType,
);

export const selectBoardingCompleted = createSelector(
  selectStatus,
  (s) => s.boardingCompleted,
);

export const selectHomeTabName = createSelector(
  selectStatus,
  (s) => s.homeTabName,
);

export const selectGuideToPushFirstTime = createSelector(
  selectStatus,
  (s) => s.guideToPushFirstTime,
);

export const selectWebviewGlobalKey = createSelector(
  selectStatus,
  (s) => s.webviewGlobalKey,
);

export const selectFirstTimeShowCheckRPCNodeTooltip = createSelector(
  selectStatus,
  (s) => s.firstTimeShowCheckRPCNodeTooltip,
);
