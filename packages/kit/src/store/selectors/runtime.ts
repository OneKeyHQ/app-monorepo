import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectRuntime = (state: IAppState) => state.runtime;

export const selectRuntimeNetworks = createSelector(
  selectRuntime,
  (s) => s.networks,
);

export const selectRuntimeAccounts = createSelector(
  selectRuntime,
  (s) => s.accounts,
);

export const selectRuntimeWallets = createSelector(
  selectRuntime,
  (s) => s.wallets,
);
