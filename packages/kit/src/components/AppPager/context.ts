import { createContext, useContext } from 'react';

export const AppPagerContext = createContext<{
  focusedName: string;
  scrollToTop: () => void;
}>({ focusedName: '', scrollToTop: () => {} });

export const AppPagerPageContext = createContext({
  key: '',
  name: '',
  isFocused: true,
});
export const useAppPager = () => useContext(AppPagerContext);
