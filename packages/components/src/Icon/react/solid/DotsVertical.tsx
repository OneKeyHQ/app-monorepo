import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgDotsVertical = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M10 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
  </Svg>
);

export default SvgDotsVertical;
