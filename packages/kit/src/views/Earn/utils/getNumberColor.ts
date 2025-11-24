import type { ISizableTextProps } from '@onekeyhq/components';

export const getNumberColor = (
  value: string | number,
  defaultColor: ISizableTextProps['color'] = '$textSuccess',
): ISizableTextProps['color'] =>
  (typeof value === 'string' ? Number(value) : value) === 0
    ? '$text'
    : defaultColor;
