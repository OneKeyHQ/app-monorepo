import React, { ComponentProps, FC } from 'react';

import { Switch as BaseSwitch } from 'native-base';

import Box from '../Box';
import Typography from '../Typography';

export type SwitchSize = 'sm' | 'lg';
export type LabelType = 'false' | 'after' | 'before';

export type SwitchProps = {
  /**
   * 选中状态
   */
  isChecked?: boolean;
  /**
   * 标签摆放位置
   */
  labelType?: LabelType;
  /**
   * 控件大小
   */
  size?: SwitchSize;
  /**
   * 标签
   */
  label?: string;
  /**
   * 是否禁用
   */
  isDisabled?: boolean;
  /**
   * 点击监听
   */
  onToggle?: () => void;
} & ComponentProps<typeof BaseSwitch>;

const defaultProps = {
  isChecked: false,
  isDisabled: false,
  size: 'sm',
  label: 'false',
} as const;

const getRectSize = (size: SwitchSize = 'sm'): [number, number] => {
  const sizeMap: Record<SwitchSize, [number, number]> = {
    'sm': [10, 5],
    'lg': [12, 6],
  };
  return sizeMap[size];
};

const Switch: FC<SwitchProps> = ({
  isChecked,
  labelType,
  size,
  label,
  isDisabled,
  onToggle,
  ...props
}) => {
  const [w, h] = getRectSize(size);

  return (
    <Box
      alignItems="center"
      flexDirection={labelType === 'after' ? 'row-reverse' : 'row'}
    >
      {labelType !== 'false' && (
        <Typography.Body2
          fontWeight="bold"
          mr={3}
          ml={3}
          color={isDisabled ? 'text-disabled' : 'text-default'}
        >
          {label}
        </Typography.Body2>
      )}

      <BaseSwitch
        w={w}
        h={h}
        onThumbColor="icon-on-primary"
        offThumbColor="icon-on-primary"
        onTrackColor="action-primary-default"
        offTrackColor="surface-neutral-default"
        {...props}
        isChecked={isChecked}
        isDisabled={isDisabled}
        onToggle={onToggle}
      />
    </Box>
  );
};

Switch.defaultProps = defaultProps;
export default Switch;
