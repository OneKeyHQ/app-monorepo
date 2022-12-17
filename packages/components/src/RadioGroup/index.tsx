import type { FC } from 'react';

import { Radio as BaseRadio } from 'native-base';

import type { IRadioGroupProps } from 'native-base';

export type RadioGroupProps = {
  /**
   * 是否禁用
   */
  isDisabled?: boolean;
} & IRadioGroupProps;

const RadioGroup: FC<RadioGroupProps> = ({ children, ...props }) => (
  <BaseRadio.Group {...props}>{children}</BaseRadio.Group>
);

export default RadioGroup;
