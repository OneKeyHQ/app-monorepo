import { useMemo } from 'react';

import { createSelector } from '@reduxjs/toolkit';

import {
  allNetworksAccountRegex,
  generateFakeAllnetworksAccount,
} from '@onekeyhq/engine/src/managers/account';

import { useAppSelector } from './useAppSelector';

import type { IAppState } from '../store';

export const useAllNetworkAccountInfo = ({
  accountId,
}: {
  accountId: string;
}) =>
  useMemo(() => {
    if (!allNetworksAccountRegex.test(accountId)) {
      return;
    }
    return generateFakeAllnetworksAccount({ accountId });
  }, [accountId]);

const selectAllNetworksAccountsMap = (state: IAppState) =>
  state.overview.allNetworksAccountsMap;

export const makeGetAllNetworksAccountsSelector = (accountId?: string | null) =>
  createSelector(
    [selectAllNetworksAccountsMap],
    (map) => map?.[accountId || ''] ?? {},
  );

export const useAllNetworksWalletAccounts = ({
  accountId,
}: {
  accountId?: string | null;
}) => {
  const getAllNetworksAccounts = useMemo(
    () => makeGetAllNetworksAccountsSelector(accountId),
    [accountId],
  );
  const data = useAppSelector(getAllNetworksAccounts);

  return {
    data,
  };
};
