import { Suspense, forwardRef } from 'react';

import { useThemeValue } from '@onekeyhq/components/src/Provider/hooks/useThemeValue';
import { createSuspender } from '@onekeyhq/shared/src/modules3rdParty/use-suspender';

import ICON_CONFIG from './Icons';

import type { ICON_NAMES } from './Icons';
import { GetProps, styled } from 'tamagui';
import type { Svg, SvgProps } from 'react-native-svg';
import { TextStyle } from 'react-native';
import { Skeleton } from '../Skeleton';

export type IconContainerProps = Omit<SvgProps, 'color' | 'style'> & {
  name?: ICON_NAMES;
  style?: TextStyle;
};

const ComponentMaps: Record<string, typeof Svg> = {};

const DEFAULT_SIZE = 24


const { useSuspender } = createSuspender((name: ICON_NAMES) => new Promise<typeof Svg>((resolve) => {
  if (ComponentMaps[name]) {
    resolve(ComponentMaps[name])
  } else {
    ICON_CONFIG[name]().then((module: any) => {
      ComponentMaps[name] = module.default as typeof Svg;
      resolve(ComponentMaps[name])
    })
  }
}))

function IconLoader({ name, ...props }: {
  name: ICON_NAMES;
  width: number;
  height: number;
  color: string;
  style?: TextStyle;
} ) {
  const SVGComponent = useSuspender(name);
  return (
    <SVGComponent {...props} />
  )
}
const IconContainer = forwardRef(({ name, style }: IconContainerProps, _) => {
  if (!name) {
    return null
  }
  const defaultColor = useThemeValue('icon-default') as string;
  const primaryColor: string = (style?.color as string) || defaultColor;

  const Svg = ComponentMaps[name] 

  const componentWidth = style?.width as number || DEFAULT_SIZE
  const componentHeight = style?.height as number || DEFAULT_SIZE
  const componentColor = primaryColor || defaultColor
  return Svg ? (
    <Svg
      width={componentWidth}
      height={componentHeight}
      style={style}
      color={componentColor}
    />
  ) : (
    <Suspense fallback={null}>
      <IconLoader
      width={componentWidth}
      height={componentHeight}
        style={style}
        color={componentColor}
        name={name}
      />
    </Suspense>
  )
});

export const Icon = styled(IconContainer, {
  variants: {
    color: {
      '...color': (color) => ({
        height: undefined,
        width: undefined,
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
        type SizeType = keyof typeof tokens.size;
        const size = tokens.size[rawSize as SizeType].val;
        return {
          width: size,
          height: size,
        };
      },
    },
  } as const,
});

export type { ICON_NAMES };
export type IconProps = GetProps<typeof Icon> & IconContainerProps;
