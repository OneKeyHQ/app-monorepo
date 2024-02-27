import type { PropsWithChildren } from 'react';

export type IFormControlProps<IValueType, T = unknown> = T & {
  onChange?: (value: IValueType) => void;
  value?: IValueType;
} & PropsWithChildren;
