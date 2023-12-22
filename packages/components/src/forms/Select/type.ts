import type { PropsWithChildren, ReactElement } from 'react';

import type { IPopoverProps } from '../../actions';
import type { ListItemProps, SheetProps } from 'tamagui';

export interface ISelectRenderTriggerProps {
  value?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export interface ISelectTriggerProps {
  renderTrigger: (props: ISelectRenderTriggerProps) => ReactElement;
}

export interface ISelectItem {
  label: string;
  value: string;
  leading?: ListItemProps['icon'];
}

export interface ISelectItemProps extends ISelectItem {
  onSelect: (item: ISelectItem) => void;
  selectedValue?: string | ISelectItem;
}

export interface ISelectSection {
  data: ISelectItem[];
  title?: string;
}

export type ISelectProps<T extends string | ISelectItem> = PropsWithChildren<{
  labelInValue?: boolean;
  items?: ISelectItem[];
  sections?: ISelectSection[];
  placeholder?: string;
  title: string;
  value?: T;
  onChange?: (value: T) => void;
  renderTrigger?: ISelectTriggerProps['renderTrigger'];
  disabled?: boolean;
  sheetProps?: SheetProps;
  placement?: IPopoverProps['placement'];
}>;
