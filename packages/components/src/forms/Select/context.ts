import type { Dispatch, SetStateAction } from 'react';
import { createContext } from 'react';

import type { ISelectItem, ISelectSection } from './type';
import type { SheetProps } from 'tamagui';

export const SelectContext = createContext<{
  isOpen?: boolean;
  value?: string;
  items?: ISelectItem[];
  onValueChange?: (value: string) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  sections?: ISelectSection[];
  refreshState?: number;
  changeOpenStatus?: Dispatch<SetStateAction<boolean>>;
  sheetProps?: SheetProps;
}>({});
