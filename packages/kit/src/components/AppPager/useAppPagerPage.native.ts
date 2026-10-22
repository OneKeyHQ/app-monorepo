import { useContext } from 'react';

import { AppPagerPageContext } from './context';

export const useAppPagerPage = () => useContext(AppPagerPageContext);
