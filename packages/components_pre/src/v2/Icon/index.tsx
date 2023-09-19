import { useEffect, useState } from 'react';
import type { FC } from 'react';

import { useThemeValue } from '@onekeyhq/components';
import { useIsMounted } from '@onekeyhq/kit/src/hooks/useIsMounted';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ICON_CONFIG from './Icons';

// import type { ThemeToken } from '../Provider/theme';
import type { ICON_NAMES } from './Icons';
import type { SvgProps } from 'react-native-svg';

export type IconProps = Omit<SvgProps, 'color'> & {
  name: ICON_NAMES;
  size?: number;
  color?: any;
};

export const Icon: FC<IconProps> = platformEnv.isExtensionBackground
  ? ((() => null) as FC<IconProps>)
  : ({ name, size = 24, color, width, height }) => {
      const defaultColor = useThemeValue('icon-default');
      const primaryColor = useThemeValue(color ?? 'icon-default');
      let SVGComponent = ICON_CONFIG[name];
      const [, setRefreshKey] = useState(Math.random());
      const isMounted = useIsMounted();

      useEffect(() => {
        // @ts-ignore
        if (!SVGComponent?.__ready && SVGComponent) {
          SVGComponent().then((module) => {
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
        // @ts-ignore
        <SVGComponent
          // @ts-ignore
          width={width ?? size ?? 'auto'}
          height={height ?? size ?? 'auto'}
          color={svgColor}
        />
      );
    };

export type { ICON_NAMES };
