import { createContext } from 'react';

export type IPageTypeContextType = {
  pageType: 'modal';
};
export const PageTypeContext = createContext<IPageTypeContextType>(
  {} as IPageTypeContextType,
);
