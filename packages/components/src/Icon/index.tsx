import { useEffect, useState } from 'react';
import type { FC } from 'react';

import type { SvgProps } from 'react-native-svg';

import { useThemeValue } from '@onekeyhq/components';
import { ThemeToken } from '../Provider/theme';

import ICON_CONFIG, { ICON_NAMES } from './Icons';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type IconProps = Omit<SvgProps, 'color'> & {
  name: ICON_NAMES;
  size?: number;
  color?: ThemeToken;
};

const Icon: FC<IconProps> = ({ name, size = 24, color }) => {
  const defaultColor = useThemeValue('icon-default');
  const primaryColor = useThemeValue(color ?? 'icon-default');
  let SVGComponent = ICON_CONFIG[name];
  const [_, setRefreshKey] = useState(Math.random());

  useEffect(() => {
    // @ts-ignore
    if (!SVGComponent.__ready) {
      SVGComponent().then((module) => {
        // @ts-ignore
        SVGComponent = module.default;
        // @ts-ignore
        SVGComponent.__ready = true;
        // @ts-ignore
        ICON_CONFIG[name] = SVGComponent;
        setRefreshKey(Math.random());
      });
    }
  }, [name]);

  // @ts-ignore
  if (!SVGComponent.__ready) return null;

  const svgColor = primaryColor || defaultColor;

  return (
    // @ts-ignore
    <SVGComponent
      // @ts-ignore
      width={size ?? 'auto'}
      height={size ?? 'auto'}
      color={svgColor}
    />
  );
};

export default platformEnv.isExtensionBackground
  ? ((() => null) as FC<IconProps>)
  : Icon;
export type { ICON_NAMES };
