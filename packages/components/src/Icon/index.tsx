import React, { FC } from 'react';

import { SvgProps } from 'react-native-svg';

import { useThemeValue } from '../Provider/hooks';
import { ThemeValues } from '../Provider/theme';

import ICON_CONFIG, { ICON_NAMES } from './Icons';

export type IconProps = Omit<SvgProps, 'color'> & {
  name: ICON_NAMES;
  size?: number;
  color?: keyof ThemeValues;
};

const defaultProps = { size: 24 } as const;

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
