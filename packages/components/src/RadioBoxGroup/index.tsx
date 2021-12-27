import React, { ComponentProps, FC } from 'react';

import { IBoxProps, IRadioValue } from 'native-base';

import Box from '../Box';
import { RadioBoxProps } from '../RadioBox';

interface IRadioBoxGroupProps extends IBoxProps<RadioBoxGroupProps> {
  /**
   * 当前 Group 选中的值
   */
  value?: IRadioValue;
  /**
   * 按钮组名字.
   */
  name: string;
  /**
   * 默认选中的值
   */
  defaultValue?: IRadioValue;
  /**
   * 禁用按钮
   */
  isDisabled?: boolean;
  /**
   * 选中状态的回调
   */
  onChange?: (value: IRadioValue) => any;
  /**
   * 选项通用样式
   */
  radioProps?: ComponentProps<typeof Box>;
  children?: React.ReactElement<RadioBoxProps>[];
}

export type RadioBoxGroupProps = IRadioBoxGroupProps;

const RadioBoxGroup: FC<RadioBoxGroupProps> = ({
  value,
  size,
  defaultValue,
  isDisabled,
  onChange,
  children,
  radioProps,
  ...props
}) => (
  <Box w="100%" flex={1} {...props} p={4}>
    {children &&
      children.map((child) => {
        const { value: childValue, children: childChildren } = child.props;

        return React.cloneElement(child, {
          ...child.props,
          ...radioProps,
          isChecked: value === childValue,
          onChange: (checkedValue: IRadioValue) => {
            if (onChange) onChange(checkedValue);
          },
          children: childChildren,
        });
      })}
  </Box>
);

export default RadioBoxGroup;
