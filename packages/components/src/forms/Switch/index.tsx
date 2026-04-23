import { useCallback, useMemo, useState } from 'react';

import { TMSwitch, useTheme } from '@onekeyhq/components/src/shared/tamagui';
import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IFormFieldProps } from '../types';

export enum ESwitchSize {
  extraSmall = 'extraSmall',
  small = 'small',
  large = 'large',
}

type ISwitchSize = 'extraSmall' | 'small' | 'large';

const SWITCH_SIZE_CONFIG = {
  extraSmall: {
    trackWidth: 32,
    trackHeight: '$5',
    thumbSize: '$4',
  },
  small: {
    trackWidth: 38,
    trackHeight: '$6',
    thumbSize: '$5',
  },
  large: {
    trackWidth: 54,
    trackHeight: '$8',
    thumbSize: '$7',
  },
} as const;

export type ISwitchProps = IFormFieldProps<
  boolean,
  Omit<GetProps<typeof TMSwitch>, 'checked' | 'onCheckedChange' | 'value'> & {
    size?: ISwitchSize;
    thumbProps?: Partial<GetProps<typeof TMSwitch.Thumb>>;
  }
> & {
  isUncontrolled?: boolean;
};

export function Switch({
  value,
  defaultChecked,
  onChange,
  size = 'large',
  disabled,
  isUncontrolled,
  thumbProps,
  ...restProps
}: ISwitchProps) {
  const theme = useTheme();
  const [stateChecked, setStateChecked] = useState(defaultChecked);
  const sizeConfig = SWITCH_SIZE_CONFIG[size];
  let nativeScale = 1;
  if (size === ESwitchSize.extraSmall) {
    nativeScale = platformEnv.isNativeAndroid ? 0.82 : 0.7;
  }

  const checked = isUncontrolled ? stateChecked : value;

  const handleCheckedChange = useCallback(
    (v: boolean) => {
      if (isUncontrolled) {
        setStateChecked(v);
      }
      onChange?.(v);
    },
    [isUncontrolled, onChange],
  );

  const nativeProps = useMemo(
    () => ({
      disabled,
      ios_backgroundColor: theme.neutral5.val,
      trackColor: {
        false: theme.neutral5.val,
        true: theme.bgPrimary.val,
      },
      thumbColor: theme.bg.val,
      style: {
        opacity: disabled ? 0.5 : 1,
        ...(nativeScale !== 1
          ? {
              transform: [{ scaleX: nativeScale }, { scaleY: nativeScale }],
            }
          : {}),
      },
    }),
    [
      disabled,
      nativeScale,
      theme.neutral5.val,
      theme.bgPrimary.val,
      theme.bg.val,
    ],
  );

  return (
    <TMSwitch
      tag="span"
      flexShrink={0}
      unstyled
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={handleCheckedChange}
      native
      w={sizeConfig.trackWidth}
      h={sizeConfig.trackHeight}
      minHeight={sizeConfig.trackHeight}
      bg={checked ? '$bgPrimary' : '$neutral5'}
      p="$0"
      borderRadius="$full"
      borderWidth="$0.5"
      borderColor="$transparent"
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      nativeProps={nativeProps}
      {...restProps}
    >
      <TMSwitch.Thumb
        unstyled
        w={sizeConfig.thumbSize}
        h={sizeConfig.thumbSize}
        borderRadius="$full"
        bg="$bg"
        animation="switch"
        animateOnly={ANIMATE_ONLY_TRANSFORM}
        {...thumbProps}
      />
    </TMSwitch>
  );
}
