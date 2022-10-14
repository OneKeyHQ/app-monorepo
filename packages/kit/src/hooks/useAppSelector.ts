import { TypedUseSelectorHook, useSelector } from 'react-redux';

import { IAppState } from '../store';

export const useAppSelector: TypedUseSelectorHook<IAppState> = useSelector;
