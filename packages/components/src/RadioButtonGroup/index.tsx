import type { FC, ReactElement } from 'react';

import Box from '../Box';
import RadioButton from '../RadioButton';

import type { ButtonSize } from '../Button';
import type { RadioButtonProps } from '../RadioButton';
import type { IBoxProps, IRadioValue } from 'native-base';

interface IRadioButtonGroupProps extends IBoxProps<IRadioButtonGroupProps> {
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
   * 按钮大小
   */
  size?: ButtonSize;
  /**
   * 选中状态的回调
   */
  onChange?: (value: IRadioValue) => any;
  children: ReactElement<RadioButtonProps>[];
}

export type RadioButtonGroupProps = IRadioButtonGroupProps;

const RadioButtonGroup: FC<RadioButtonGroupProps> = ({
  value,
  size,
  defaultValue,
  isDisabled,
  onChange,
  children,
  ...props
}) => (
  <Box {...props} flexWrap="wrap" justifyContent="center">
    {children.map((child) => {
      const {
        value: childValue,
        isDisabled: childIsDisabled,
        size: childSize,
        title,
      } = child.props;

      return (
        <RadioButton
          key={childValue}
          size={size ?? childSize}
          title={title}
          value={childValue}
          isDisabled={childIsDisabled || isDisabled}
          isChecked={value === childValue}
          onChange={(checkedValue) => {
            if (onChange) onChange(checkedValue);
          }}
        />
      );
    })}
  </Box>
);

export default RadioButtonGroup;
