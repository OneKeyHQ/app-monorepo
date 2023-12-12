import type { Dispatch, SetStateAction } from 'react';
import { createContext } from 'react';

import type { IPageButtonGroupProps } from './PageButtonGroup';

export const PageContext = createContext<{
  options?: { footerOptions?: IPageButtonGroupProps; scrollEnabled?: boolean };
  setOptions?: Dispatch<
    SetStateAction<{
      footerOptions?: IPageButtonGroupProps;
      scrollEnabled?: boolean;
    }>
  >;
}>({});
