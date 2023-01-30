import type { ComponentProps, FC } from 'react';

import { Switch as BaseSwitch } from 'native-base';
import { TouchableNativeFeedback } from 'react-native-gesture-handler';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Box from '../Box';
import Typography from '../Typography';

import type { ISizes } from 'native-base/lib/typescript/theme/base/sizes';

export type SwitchSize = 'sm' | 'lg' | 'mini';
export type LabelType = 'false' | 'after' | 'before';

export interface SwitchProps extends ComponentProps<typeof BaseSwitch> {
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
}

const sizeMap: Record<SwitchSize, ISizes> = {
  'sm': 'md',
  'lg': 'lg',
  'mini': 'sm',
};

const Switch: FC<SwitchProps> = ({
  isChecked = false,
  labelType,
  size = 'sm',
  label = 'false',
  isDisabled = false,
  onToggle,
  isFullMode,
  ...props
}) => {
  const iSize = sizeMap[size];
  const content = (
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
        _hover={{
          offTrackColor: 'surface-neutral-hovered',
          onTrackColor: 'action-primary-hovered',
        }}
      />
    </Box>
  );
  return platformEnv.isNativeAndroid ? (
    // use TouchableNativeFeedback from gesture-handler
    // to avoid the touch conflict with bottomsheet
    <TouchableNativeFeedback disabled={isDisabled} onPress={onToggle}>
      {content}
    </TouchableNativeFeedback>
  ) : (
    content
  );
};
export default Switch;
