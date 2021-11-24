import React, { FC } from 'react';
import { SvgProps } from 'react-native-svg';

import ICON_CONFIG, { ICON_NAMES } from './Icons';

export type IconProps = SvgProps & {
  name: ICON_NAMES;
  size?: number;
};

const defaultProps = {
  size: 24,
} as const;

const Icon: FC<IconProps> = ({ name, size, color }) => {
  const SVGComponent = ICON_CONFIG[name];
  if (!SVGComponent) return null;

  return (
    <SVGComponent
      width={size ?? 'auto'}
      height={size ?? 'auto'}
      color={color}
    />
  );
};

Icon.defaultProps = defaultProps;

export default Icon;
