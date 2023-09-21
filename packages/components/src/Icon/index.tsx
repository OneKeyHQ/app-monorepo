import { Component, useEffect, useState } from 'react';

import { useThemeValue } from '@onekeyhq/components/src/Provider/hooks/useThemeValue';
import { useIsMounted } from '@onekeyhq/components/src/Provider/hooks/useIsMounted';

import ICON_CONFIG from './Icons';

import type { ICON_NAMES } from './Icons';
import { styled, GetProps, Stack, Tokens } from 'tamagui'
import type { Svg, SvgProps } from 'react-native-svg';
import { TextStyle } from 'react-native';

export type IconProps = Omit<SvgProps, 'color'> & {
  name?: ICON_NAMES;
  style?: TextStyle;
};

const ComponentMaps: Record<string, typeof Svg> = {}

const RawIcon = ({ name = 'AkashIllus', style }: IconProps) => {
  const width = style?.width  || 24
  const height = style?.height || 24
  const defaultColor = useThemeValue('icon-default') as string;
  const primaryColor: string = style?.color as string || defaultColor;
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
    return null
  }

  return (
    <SVGComponent
      width={width}
      height={height}
      color={primaryColor || defaultColor}
    />
  );
}

export const Icon = styled(RawIcon, {
  variants: {
    color: {
      "...color": (color) => ({
        height: undefined,
        width: undefined,
        color,
      }),
    },
    size: {
      '...size': (size) => {
        return ({
          width: size,
          height: size,
        })
      },
    },
  } as const
});

export type { ICON_NAMES };
