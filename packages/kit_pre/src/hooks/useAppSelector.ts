import { useSelector } from 'react-redux';

import type { IAppState } from '../store';
import type { TypedUseSelectorHook } from 'react-redux';

export const useAppSelector: TypedUseSelectorHook<IAppState> = useSelector;
