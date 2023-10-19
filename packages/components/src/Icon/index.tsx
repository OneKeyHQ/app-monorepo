import { Component, useEffect, useState } from 'react';

import { useThemeValue } from '@onekeyhq/components/src/Provider/hooks/useThemeValue';
import { useIsMounted } from '@onekeyhq/components/src/Provider/hooks/useIsMounted';

import ICON_CONFIG from './Icons';

import type { ICON_NAMES } from './Icons';
import { styled } from 'tamagui';
import type { Svg, SvgProps } from 'react-native-svg';
import { TextStyle } from 'react-native';

export type IconProps = Omit<SvgProps, 'color'> & {
  name?: ICON_NAMES;
  style?: TextStyle;
};

const ComponentMaps: Record<string, typeof Svg> = {};

const DEFAULT_SIZE = 24
const RawIcon = ({ name = 'AkashIllus', style }: IconProps) => {
  const defaultColor = useThemeValue('icon-default') as string;
  const primaryColor: string = (style?.color as string) || defaultColor;
  const SVGComponent = ComponentMaps[name];
  const [, setRefreshKey] = useState(Math.random());
  const isMounted = useIsMounted();

  useEffect(() => {
    if (!SVGComponent && ICON_CONFIG[name]) {
      ICON_CONFIG[name]().then((module: any) => {
        ComponentMaps[name] = module.default as typeof Svg;
        if (isMounted) {
          setRefreshKey(Math.random());
        }
      });
    }
  }, [name]);

  if (!SVGComponent) {
    return null;
  }

  return (
    <SVGComponent
      width={style?.width || DEFAULT_SIZE}
      height={style?.height || DEFAULT_SIZE}
      style={style}
      color={primaryColor || defaultColor}
    />
  );
};

export const Icon = styled(RawIcon, {
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
