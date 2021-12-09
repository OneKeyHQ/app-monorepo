import React, { FC } from 'react';
import { IRadioValue } from 'native-base';
import Button, { ButtonProps, ButtonSize } from '../Button';

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
   * 按钮大小
   */
  size?: ButtonSize;
  /**
   * 禁用按钮
   */
  isDisabled?: boolean;
  /**
   * 点击修改状态
   */
  onChange?: (value: IRadioValue) => void;
} & ButtonProps;

const getMargin = (size: ButtonSize = 'base'): [number, number] => {
  const sizeMap: Record<ButtonSize, [number, number]> = {
    'base': [1.5, 1],
    'xs': [1.5, 1],
    'sm': [1.5, 1],
    'lg': [1.5, 1],
    'xl': [1.5, 1.5],
  };
  return sizeMap[size];
};

const RadioButton: FC<RadioButtonProps> = ({
  value,
  title,
  size,
  isChecked,
  isDisabled,
  onChange,
  ...props
}) => {
  const [vertical, horizontal] = getMargin(size);
  let bg;
  if (isChecked) {
    if (isDisabled) {
      bg = 'action-primary-disabled';
    } else {
      bg = 'action-primary-default';
    }
  } else {
    bg = 'action-secondary-default';
  }

  return (
    <Button
      ml={horizontal}
      mr={horizontal}
      mt={vertical}
      mb={vertical}
      size={size}
      key={value.toString()}
      isDisabled={isDisabled}
      {...props}
      onPress={() => {
        if (onChange) onChange(value);
      }}
      bg={bg}
      _hover={{
        bg,
        borderColor: 'border-default',
      }}
      _pressed={{
        background: bg,
        borderColor: 'border-default',
      }}
      _focus={{
        background: bg,
        borderColor: 'border-default',
      }}
      _disabled={{
        background: bg,
        borderColor: 'border-disabled',
      }}
    >
      {title}
    </Button>
  );
};

export default RadioButton;
