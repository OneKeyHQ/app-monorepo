import type { Dispatch, ReactElement, SetStateAction } from 'react';
import { createContext } from 'react';

export const PageContext = createContext<{
  options?: {
    safeAreaEnabled?: boolean;
    footerElement?: ReactElement;
    scrollEnabled?: boolean;
    avoidHeight?: number;
  };
  setOptions?: Dispatch<
    SetStateAction<{
      safeAreaEnabled?: boolean;
      footerElement?: ReactElement;
      scrollEnabled?: boolean;
      avoidHeight?: number;
    }>
  >;
}>({});
