import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgCloud = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M5.5 16a3.5 3.5 0 0 1-.369-6.98 4 4 0 1 1 7.753-1.977A4.5 4.5 0 1 1 13.5 16h-8z" />
  </Svg>
);

export default SvgCloud;
