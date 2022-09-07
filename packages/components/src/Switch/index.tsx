import React, { ComponentProps, FC } from 'react';

import { Switch as BaseSwitch } from 'native-base';
import { ISizes } from 'native-base/lib/typescript/theme/base/sizes';

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

const getRectSize = (size: SwitchSize = 'sm'): ISizes => {
  const sizeMap: Record<SwitchSize, ISizes> = {
    'sm': 'md',
    'lg': 'lg',
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
  const iSize = getRectSize(size);

  return (
    <Box
      alignItems="center"
      flexDirection={labelType === 'after' ? 'row-reverse' : 'row'}
    >
      {labelType !== 'false' && (
        <Typography.Body2Strong
          fontWeight="bold"
          mr={3}
          ml={3}
          color={isDisabled ? 'text-disabled' : 'text-default'}
        >
          {label}
        </Typography.Body2Strong>
      )}

      <BaseSwitch
        size={iSize}
        onThumbColor="icon-on-primary"
        offThumbColor="icon-on-primary"
        onTrackColor="action-primary-default"
        offTrackColor="surface-neutral-default"
        {...props}
        isChecked={isChecked}
        isDisabled={isDisabled}
        onToggle={onToggle ? () => setTimeout(onToggle) : undefined}
      />
    </Box>
  );
};

Switch.defaultProps = defaultProps;
export default Switch;
