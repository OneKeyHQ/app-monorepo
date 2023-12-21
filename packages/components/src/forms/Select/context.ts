import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { createContext } from 'react';

import type { ISelectItem, ISelectSection } from './type';
import type { IPopoverProps } from '../../actions';
import type { SheetProps } from 'tamagui';

type IContextType = {
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
  floatingPanelProps?: IPopoverProps['floatingPanelProps'];
  placement?: IPopoverProps['placement'];
  selectedItemRef: MutableRefObject<ISelectItem>;
};
export const SelectContext = createContext<IContextType>({} as IContextType);
