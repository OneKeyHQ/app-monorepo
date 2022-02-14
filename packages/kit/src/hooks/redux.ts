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
