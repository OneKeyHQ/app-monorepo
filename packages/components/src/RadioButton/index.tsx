import type { FC } from 'react';

import Button from '../Button';

import type { ButtonProps } from '../Button';
import type { IRadioValue } from 'native-base';

export type RadioButtonProps = {
  /**
   * 是否选中
   */
  isChecked?: boolean;
  /**
   * 按钮代表的数值
   */
  value: IRadioValue;
  /**
   * 选择说明
   */
  title?: string;
  /**
   * 禁用按钮
   */
  isDisabled?: boolean;
  /**
   * 点击修改状态
   */
  onChange?: (value: IRadioValue) => void;
  onCheckedChange?: (checked: boolean) => void;
} & ButtonProps;

const RadioButton: FC<RadioButtonProps> = ({
  value,
  title,
  size,
  isChecked,
  isDisabled,
  onChange,
  onCheckedChange,
  ...props
}) => (
  <Button
    size={size}
    key={value.toString()}
    isDisabled={isDisabled}
    borderWidth={0}
    type={isChecked ? 'primary' : 'plain'}
    onPress={() => {
      if (onChange) onChange(value);
      if (onCheckedChange && !isDisabled) {
        onCheckedChange(!isChecked);
      }
    }}
    {...props}
  >
    {title}
  </Button>
);

export default RadioButton;
