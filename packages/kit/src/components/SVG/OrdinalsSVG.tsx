import Svg, { Circle } from 'react-native-svg';

import { useThemeValue } from '@onekeyhq/components';

import type { SvgProps } from 'react-native-svg';

export default function OrdinalsSVG(props: SvgProps) {
  const [iconDefault] = useThemeValue(['icon-default']);

  return (
    <Svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
      <Circle cx="8" cy="8" r="5.5" stroke={iconDefault} />
      <Circle cx="8" cy="8" r="4" fill={iconDefault} />
    </Svg>
  );
}
