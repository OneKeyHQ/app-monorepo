import { createContext } from 'react';

import type { EPageType } from './pageType';

export type IPageTypeContextType = {
  pageType: EPageType;
};
export const PageTypeContext = createContext<IPageTypeContextType>(
  {} as IPageTypeContextType,
);
