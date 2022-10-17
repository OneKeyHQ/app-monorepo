import { ComponentProps, FC, useEffect, useRef, useState } from 'react';

import { Switch as BaseSwitch } from 'native-base';
import { ISizes } from 'native-base/lib/typescript/theme/base/sizes';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
  const [isCheckedLocal, setIsCheckedLocal] = useState(isChecked);
  const isCheckedLocalRef = useRef(isCheckedLocal);
  isCheckedLocalRef.current = isCheckedLocal;
  useEffect(() => {
    if (isCheckedLocalRef.current !== isChecked) {
      setIsCheckedLocal(isChecked);
    }
  }, [isChecked]);

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
        isChecked={isCheckedLocal}
        isDisabled={isDisabled}
        onToggle={
          onToggle
            ? () => {
                if (platformEnv.isNative) {
                  setIsCheckedLocal((v) => !v);
                  setTimeout(onToggle);
                } else {
                  onToggle();
                }
              }
            : undefined
        }
      />
    </Box>
  );
};

Switch.defaultProps = defaultProps;
export default Switch;
