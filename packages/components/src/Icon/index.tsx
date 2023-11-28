import { Suspense, forwardRef } from 'react';

import { useThemeValue } from '@onekeyhq/components/src/Provider/hooks/useThemeValue';
import { createSuspender } from '@onekeyhq/shared/src/modules3rdParty/use-suspender';

import ICON_CONFIG from './Icons';

import type { IKeyOfIcons } from './Icons';
import { GetProps, styled, withStaticProperties } from 'tamagui';
import type { Svg, SvgProps } from 'react-native-svg';
import { TextStyle } from 'react-native';
import { View } from '../View';

export type IIconContainerProps = Omit<SvgProps, 'color' | 'style'> & {
  name?: IKeyOfIcons;
  style?: TextStyle;
};

const ComponentMaps: Record<string, typeof Svg> = {};

const DEFAULT_SIZE = 24

const loadIcon = (name: IKeyOfIcons) =>  {
  return new Promise<typeof Svg>(resolve => {
    ICON_CONFIG[name]().then((module: any) => {
      ComponentMaps[name] = module.default as typeof Svg;
      resolve(ComponentMaps[name])
    })
  })
}

const { useSuspender } = createSuspender((name: IKeyOfIcons) => new Promise<typeof Svg>((resolve) => {
  if (ComponentMaps[name]) {
    resolve(ComponentMaps[name])
  } else {
    loadIcon(name).then(resolve)
  }
}))

function IconLoader({ name, ...props }: {
  name: IKeyOfIcons;
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
const IconContainer = forwardRef(({ name, style }: IIconContainerProps, _) => {
  if (!name) {
    return null
  }
  const defaultColor = useThemeValue('icon');
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
    <Suspense fallback={<View style={{
      width: componentWidth,
      height: componentHeight,
    }} />}>
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

const BasicIcon = styled(IconContainer, {
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

const loadIcons = (...names: IKeyOfIcons[]) => {
  return Promise.all(names.map(name => loadIcon(name)))
}

export const Icon = withStaticProperties(BasicIcon, {
  prefetch: loadIcons,
})

export type { IKeyOfIcons };
export type IIconProps = GetProps<typeof Icon> & IIconContainerProps;
