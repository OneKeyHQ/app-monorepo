import type { ComponentType, PropsWithChildren } from 'react';

import type { ListItemProps, SheetProps } from 'tamagui';

export interface ISelectRenderTriggerProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
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
  selectedValue?: string;
}

export interface ISelectSection {
  data: ISelectItem[];
  title?: string;
}

export type ISelectProps = PropsWithChildren<{
  items?: ISelectItem[];
  sections?: ISelectSection[];
  placeholder?: string;
  title: string;
  value?: string;
  onChange?: (value: string) => void;
  renderTrigger?: ISelectTriggerProps['renderTrigger'];
  disabled?: boolean;
  sheetProps?: SheetProps;
}>;
