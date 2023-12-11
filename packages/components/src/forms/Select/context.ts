import type { Dispatch, SetStateAction } from 'react';
import { createContext } from 'react';

import type { ISelectItem } from './type';

export const SelectContext = createContext<{
  isOpen?: boolean;
  value?: string;
  items?: ISelectItem[];
  onValueChange?: (value: string) => void;
  placeholder?: string;
  title?: string;
  changeOpenStatus?: Dispatch<SetStateAction<boolean>>;
}>({});
