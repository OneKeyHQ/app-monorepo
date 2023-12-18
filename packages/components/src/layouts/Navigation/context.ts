import { createContext } from 'react';

export type INavigationContextType = {
  pageType: 'modal';
};
export const NavigationContext = createContext<INavigationContextType>(
  {} as INavigationContextType,
);
