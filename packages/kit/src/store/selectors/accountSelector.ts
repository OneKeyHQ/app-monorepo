import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectAccountSelector = (state: IAppState) =>
  state.accountSelector;

export const selectAccountSelectorNetworkId = createSelector(
  selectAccountSelector,
  (s) => s.networkId,
);

export const selectAccountSelectorWalletId = createSelector(
  selectAccountSelector,
  (s) => s.walletId,
);

export const selectAccountsGroup = createSelector(
  selectAccountSelector,
  (s) => s.accountsGroup,
);

export const selectAccountSelectorIsLoading = createSelector(
  selectAccountSelector,
  (s) => s.isLoading,
);

export const selectAccountSelectorIsOpen = createSelector(
  selectAccountSelector,
  (s) => s.isOpen,
);

export const selectPreloadingCreateAccount = createSelector(
  selectAccountSelector,
  (s) => s.preloadingCreateAccount,
);

export const selectAccountSelectorMode = createSelector(
  selectAccountSelector,
  (s) => s.accountSelectorMode,
);

export const selectAccountSelectorIsOpenDelay = createSelector(
  selectAccountSelector,
  (s) => s.isOpenDelay,
);
