import type { Dispatch, SetStateAction } from 'react';
import { createContext } from 'react';

import type { IPageButtonGroupProps } from './PageButtonGroup';

export const PageContext = createContext<{
  options?: { footerOptions: IPageButtonGroupProps } | undefined;
  setOptions?: Dispatch<
    SetStateAction<{ footerOptions: IPageButtonGroupProps } | undefined>
  >;
}>({});
