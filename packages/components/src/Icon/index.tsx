import { Component, useEffect, useState } from 'react';
import type { FC } from 'react';

import { useThemeValue } from '@onekeyhq/components/src/Provider/hooks/useThemeValue';
import { useIsMounted } from '@onekeyhq/components/src/Providerhooks/useIsMounted';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ICON_CONFIG from './Icons';

import type { ICON_NAMES } from './Icons';
import { GetProps, styled } from 'tamagui'
import type { SvgProps } from 'react-native-svg';

export type IconProps = Omit<SvgProps, 'color'> & {
  name: ICON_NAMES;
};

const IconComponent = styled(({ name, style }: IconProps) => {
  const width = style?.width || 24
  const height = style?.height || 24
  const defaultColor = useThemeValue('icon-default');
  const primaryColor = style?.color || defaultColor;
  let SVGComponent = ICON_CONFIG[name];
  const [, setRefreshKey] = useState(Math.random());
  const isMounted = useIsMounted();

  useEffect(() => {
    // @ts-ignore
    if (!SVGComponent?.__ready && SVGComponent) {
      SVGComponent().then((module: any) => {
        // @ts-ignore
        SVGComponent = module.default;
        // @ts-ignore
        SVGComponent.__ready = true;
        // @ts-ignore
        ICON_CONFIG[name] = SVGComponent;
        if (isMounted) {
          setRefreshKey(Math.random());
        }
      });
    }
  }, [name]);

  if (!SVGComponent) return null;

  // @ts-ignore
  if (!SVGComponent?.__ready) return null;

  const svgColor = primaryColor || defaultColor;

  return (
    <SVGComponent
      width={width}
      height={height}
      color={svgColor}
    />
  );
} , {
  variants: {
    size: {
      '...size': (size, { tokens }) => ({
        width: tokens.size[size] ?? size,
        height: tokens.size[size] ?? size,
      }),
    }
  } as const
})

export type IconComponentProps = GetProps<typeof IconComponent>

export const Icon = platformEnv.isExtensionBackground
  ? ((() => null) as unknown as typeof IconComponent)
  : IconComponent;

export type { ICON_NAMES };
