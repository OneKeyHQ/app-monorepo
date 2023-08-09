import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectGeneral = (state: IAppState) => state.general;

export const selectActiveAccountId = createSelector(
  selectGeneral,
  (s) => s.activeAccountId,
);

export const selectActiveNetworkId = createSelector(
  selectGeneral,
  (s) => s.activeNetworkId,
);

export const selectActiveWalletId = createSelector(
  selectGeneral,
  (s) => s.activeWalletId,
);

export const selectActiveExternalWalletName = createSelector(
  selectGeneral,
  (s) => s.activeExternalWalletName,
);
