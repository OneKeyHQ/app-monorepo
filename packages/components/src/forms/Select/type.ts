import type { ComponentType, PropsWithChildren } from 'react';

import type {
  ListItemProps,
  SelectProps,
  SelectTriggerProps,
  SheetProps,
} from 'tamagui';

export interface ISelectRenderTriggerProps {
  value?: string;
  placeholder?: string;
}

export interface ISelectTriggerProps {
  renderTrigger?: ComponentType<ISelectRenderTriggerProps>;
}

export interface ISelectItem {
  label: string;
  value: string;
  leading?: ListItemProps['icon'];
}

export interface ISelectItemProps extends ISelectItem {
  onSelect: (value: string) => void;
}

export interface ISelectSection {
  items: ISelectItem[];
  title?: string;
}

export type ISelectProps = PropsWithChildren<{
  items?: ISelectItem[];
  sections?: ISelectSection[];
  placeholder?: string;
  sheetProps?: SheetProps;
  title: string;
  triggerProps?: SelectTriggerProps;
  value?: string;
  onChange?: (value: string) => void;
  renderTrigger?: (item?: ISelectItem) => JSX.Element;
}>;
