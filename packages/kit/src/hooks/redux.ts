import { TypedUseSelectorHook, useSelector } from 'react-redux';

import { appDispatch } from '../store';

import type { IAppState } from '../store';

export const useAppDispatch = () => appDispatch;
export const useAppSelector: TypedUseSelectorHook<IAppState> = useSelector;

export const useSettings = () => {
  const settings = useAppSelector((s) => s.settings);
  return settings;
};

export const useStatus = () => {
  const status = useAppSelector((s) => s.status);
  return status;
};

export const useGeneral = () => {
  const general = useAppSelector((s) => s.general);
  return general;
};

export const useActiveWalletAccount = () => {
  const { activeAccount, activeWallet, activeNetwork } = useAppSelector(
    (s) => s.general,
  );

  return {
    wallet: activeWallet,
    account: activeAccount,
    network: activeNetwork,
  };
};
