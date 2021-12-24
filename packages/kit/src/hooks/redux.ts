import { TypedUseSelectorHook, useSelector } from 'react-redux';

import { appDispatch } from '../store';

import type { IAppState } from '../store';

export const useAppDispatch = () => appDispatch;

export const useAppSelector: TypedUseSelectorHook<IAppState> = useSelector;
