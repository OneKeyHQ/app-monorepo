import type { ComponentProps, FC } from 'react';

import { Switch as BaseSwitch } from 'native-base';

import Box from '../Box';
import Typography from '../Typography';

import type { ISizes } from 'native-base/lib/typescript/theme/base/sizes';

export type SwitchSize = 'sm' | 'lg' | 'mini';
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

  isFullMode?: boolean;
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
    'mini': 'sm',
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
  isFullMode,
  ...props
}) => {
  const iSize = getRectSize(size);

  return (
    <Box
      alignItems="center"
      flexDirection={labelType === 'after' ? 'row-reverse' : 'row'}
      w={isFullMode ? 'full' : undefined}
      justifyContent={isFullMode ? 'space-between' : 'flex-start'}
    >
      {labelType !== 'false' && (
        <Typography.Body2Strong
          fontWeight="bold"
          mr={3}
          ml={isFullMode ? 0 : 3}
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
        onToggle={onToggle}
      />
    </Box>
  );
};

Switch.defaultProps = defaultProps;
export default Switch;
