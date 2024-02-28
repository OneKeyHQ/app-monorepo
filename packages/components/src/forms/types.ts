import type { PropsWithChildren } from 'react';

export type IFormFieldProps<IValueType, T = unknown> = T & {
  name?: string;
  hasError?: boolean;
  onChange?: (value: IValueType) => void;
  value?: IValueType;
} & PropsWithChildren;
