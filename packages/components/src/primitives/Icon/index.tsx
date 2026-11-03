import { forwardRef } from 'react';

import { OneKeyIcon } from '@onekeyfe/react-native-image/icon';
import { I18nManager } from 'react-native';

import {
  type GetProps,
  styled,
  useTheme,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../Stack';

import { resolveIconName } from './Icons';

import type { IKeyOfIcons } from './Icons';
import type { TextStyle } from 'react-native';
import type { Svg, SvgProps } from 'react-native-svg';

export type IIconContainerProps = Omit<SvgProps, 'color' | 'style'> & {
  name?: IKeyOfIcons;
  style?: TextStyle;
};

const resourceStyle = { width: '100%', height: '100%' } as const;

function BasicIconContainer(
  {
    name,
    style,
    accessibilityRole = 'image',
    accessibilityLabel,
    testID,
    ...props
  }: IIconContainerProps & { className?: string },
  _ref: React.ForwardedRef<Svg>,
) {
  const theme = useTheme();
  if (!name) return null;
  const color = (style?.color as string) || theme.icon.val;
  return (
    <Stack
      className={props.className}
      style={style}
      accessibilityRole={platformEnv.isNative ? accessibilityRole : undefined}
      role={platformEnv.isNative ? undefined : 'img'}
      aria-label={platformEnv.isNative ? undefined : accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <OneKeyIcon
        name={resolveIconName(name, I18nManager.isRTL)}
        color={platformEnv.isNative ? color : 'inherit'}
        style={resourceStyle}
        accessible={false}
      />
    </Stack>
  );
}
const IconContainer = forwardRef(BasicIconContainer);

const BasicIcon = styled(IconContainer, {
  width: 24,
  height: 24,
  defaultVariants: { color: '$icon' },
  variants: {
    color: {
      '...color': (color) => ({
        color,
      }),
    },
    size: {
      '...size': (rawSize, { tokens }) => {
        // In fact, you can simply assign 'rawSize' to 'width' or 'height' here.
        //
        // return {
        //   width: rawSize,
        //   height: rawSize,
        // }
        //
        // But the 'width' and 'height' attributes of SVG don't accept CSS variables,
        // so you have to manually retrieve the values."
        type IBasicIconSizeType = keyof typeof tokens.size;
        const size = tokens.size[rawSize as IBasicIconSizeType].val;
        return {
          width: size,
          height: size,
        };
      },
    },
  } as const,
});

// Named resources are native-owned; these legacy entry points no longer load JS modules.
const loadIcons = (...names: IKeyOfIcons[]) =>
  Promise.resolve(names.map(() => undefined));

export const prefetchSwapColdStartIcons = () => Promise.resolve();
export function warmCriticalIcons() {}

export const Icon = withStaticProperties(BasicIcon, {
  prefetch: loadIcons,
});

export type { IKeyOfIcons };
export type IIconProps = Omit<GetProps<typeof Icon>, 'name' | 'style'> &
  IIconContainerProps;
