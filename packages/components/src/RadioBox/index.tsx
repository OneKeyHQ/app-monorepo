import React, { ComponentProps, FC } from 'react';

import { IRadioValue, Pressable } from 'native-base';

import Box from '../Box';

export type RadioBoxProps = {
  /**
   * 是否选中
   */
  isChecked?: boolean;
  /**
   * 按钮代表的数值
   */
  value: IRadioValue;
  /**
   * 禁用按钮
   */
  isDisabled?: boolean;
  /**
   * 点击修改状态
   */
  onChange?: (value: IRadioValue) => void;
} & ComponentProps<typeof Box>;

const RadioBox: FC<RadioBoxProps> = ({
  value,
  size,
  isChecked,
  isDisabled,
  onChange,
  ...props
}) => {
  let brColor = 'border-default';
  if (isChecked) {
    if (isDisabled) {
      brColor = 'action-primary-activate-disabled';
    } else {
      brColor = 'action-primary-default';
    }
  } else if (isDisabled) {
    brColor = 'border-disabled';
  } else {
    brColor = 'border-default';
  }

  let bgColor = 'action-secondary-default';
  if (isDisabled) {
    bgColor = 'action-secondary-disabled';
  } else {
    bgColor = 'action-secondary-default';
  }

  return (
    <Pressable
      disabled={isDisabled}
      onPress={() => {
        if (onChange) onChange(value);
      }}
    >
      <Box
        mt="1.5"
        mb="1.5"
        borderRadius="12px"
        borderWidth="1"
        borderColor={brColor}
        bg={bgColor}
        p={4}
        {...props}
      >
        {props.children}
      </Box>
    </Pressable>
  );
};

export default RadioBox;
