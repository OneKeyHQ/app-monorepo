import type { ComponentProps, FC, ReactElement } from 'react';
import { cloneElement } from 'react';

import Box from '../Box';

import type Pressable from '../Pressable';
import type { RadioBoxProps } from './RadioBox';
import type { IBoxProps, IRadioValue } from 'native-base';

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
  radioProps?: ComponentProps<typeof Pressable>;
  children?: ReactElement<RadioBoxProps>[];
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
  <Box w="full" flex={1} {...props} p={4}>
    {children &&
      children.map((child, index) => {
        const { value: childValue, children: childChildren } = child.props;

        return cloneElement(
          child,
          {
            ...child.props,
            ...radioProps,
            key: `RadioBox-${index}`,
            isChecked: value === childValue,
            onChange: (checkedValue: IRadioValue) => {
              if (onChange) onChange(checkedValue);
            },
          },
          childChildren,
        );
      })}
  </Box>
);

export default RadioBoxGroup;
