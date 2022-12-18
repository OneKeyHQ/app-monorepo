import type { FC } from 'react';

import { SvgProps } from 'react-native-svg';

import { useThemeValue } from '../Provider/hooks';
import { ThemeToken } from '../Provider/theme';

import ICON_CONFIG, { ICON_NAMES } from './Icons';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type IconProps = Omit<SvgProps, 'color'> & {
  name: ICON_NAMES;
  size?: number;
  color?: ThemeToken;
};

const defaultProps = { size: 24 } as const;

if (platformEnv.isExtensionBackground) {
  // debugger;
  // throw new Error('components/icon is not allowed imported from background');
}

const Icon: FC<IconProps> = ({ name, size, color }) => {
  const defaultColor = useThemeValue('icon-default');
  const primaryColor = useThemeValue(color ?? 'icon-default');

  const SVGComponent = ICON_CONFIG[name];
  if (!SVGComponent) return null;

  const svgColor = primaryColor || defaultColor;

  return (
    <SVGComponent
      width={size ?? 'auto'}
      height={size ?? 'auto'}
      color={svgColor}
    />
  );
};

Icon.defaultProps = defaultProps;

export default Icon;
export type { ICON_NAMES };
