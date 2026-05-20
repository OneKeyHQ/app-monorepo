import { useCallback, useMemo, useState } from 'react';

import { TMSwitch, useTheme } from '@onekeyhq/components/src/shared/tamagui';
import type { GetProps } from '@onekeyhq/components/src/shared/tamagui';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Spinner } from '../../primitives/Spinner';

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

const SWITCH_LOADING_SPINNER_SCALE = {
  extraSmall: 0.65,
  small: 0.75,
  large: 1,
} as const;

export type ISwitchProps = IFormFieldProps<
  boolean,
  Omit<GetProps<typeof TMSwitch>, 'checked' | 'onCheckedChange' | 'value'> & {
    size?: ISwitchSize;
    loading?: boolean;
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
  loading,
  isUncontrolled,
  thumbProps,
  testID,
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
  const isDisabled = disabled || loading;

  const handleCheckedChange = useCallback(
    (v: boolean) => {
      if (isDisabled) {
        return;
      }
      if (isUncontrolled) {
        setStateChecked(v);
      }
      onChange?.(v);
    },
    [isDisabled, isUncontrolled, onChange],
  );

  const nativeProps = useMemo(
    () => ({
      disabled: isDisabled,
      ios_backgroundColor: theme.neutral5.val,
      trackColor: {
        false: theme.neutral5.val,
        true: theme.bgPrimary.val,
      },
      thumbColor: theme.bg.val,
      style: {
        opacity: isDisabled ? 0.5 : 1,
        ...(nativeScale !== 1
          ? {
              transform: [{ scaleX: nativeScale }, { scaleY: nativeScale }],
            }
          : {}),
      },
    }),
    [
      isDisabled,
      nativeScale,
      theme.neutral5.val,
      theme.bgPrimary.val,
      theme.bg.val,
    ],
  );
  const loadingSpinnerScale = SWITCH_LOADING_SPINNER_SCALE[size];
  const resolvedThumbProps = useMemo<
    Partial<GetProps<typeof TMSwitch.Thumb>>
  >(() => {
    const loadingThumbProps: Partial<GetProps<typeof TMSwitch.Thumb>> = loading
      ? {
          alignItems: 'center',
          justifyContent: 'center',
          children: (
            <Spinner
              size="small"
              color="$iconSubdued"
              scale={loadingSpinnerScale}
            />
          ),
        }
      : {};

    return {
      ...thumbProps,
      ...loadingThumbProps,
    };
  }, [loading, loadingSpinnerScale, thumbProps]);

  return (
    <TMSwitch
      tag="span"
      flexShrink={0}
      unstyled
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={handleCheckedChange}
      native={!loading}
      w={sizeConfig.trackWidth}
      h={sizeConfig.trackHeight}
      minHeight={sizeConfig.trackHeight}
      bg={checked ? '$bgPrimary' : '$neutral5'}
      p="$0"
      borderRadius="$full"
      borderWidth="$0.5"
      borderColor="$transparent"
      opacity={isDisabled ? 0.5 : 1}
      disabled={isDisabled}
      nativeProps={nativeProps}
      testID={testID}
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
        {...resolvedThumbProps}
      />
    </TMSwitch>
  );
}
