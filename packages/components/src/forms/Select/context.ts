import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { createContext } from 'react';

import type { ISelectItem, ISelectSection } from './type';
import type { IPopoverProps } from '../../actions';
import type { SheetProps } from 'tamagui';

export type IContextType = {
  isOpen?: boolean;
  value?: string | number | boolean | undefined | ISelectItem;
  items?: ISelectItem[];
  onValueChange?: (
    value: string | number | boolean | undefined | ISelectItem,
  ) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  labelInValue: boolean;
  sections?: ISelectSection[];
  refreshState?: number;
  changeOpenStatus?: Dispatch<SetStateAction<boolean>>;
  sheetProps?: SheetProps;
  floatingPanelProps?: IPopoverProps['floatingPanelProps'];
  placement?: IPopoverProps['placement'];
  selectedItemRef: MutableRefObject<ISelectItem>;
  offset?: IPopoverProps['offset'];
};
export const SelectContext = createContext<IContextType>({} as IContextType);
