import type { PropsWithChildren } from 'react';

export type IFormFieldProps<IValueType, T = unknown> = T & {
  onChange?: (value: IValueType) => void;
  value?: IValueType;
} & PropsWithChildren;
