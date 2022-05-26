import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgSortDescending = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M3 3a1 1 0 0 0 0 2h11a1 1 0 1 0 0-2H3zm0 4a1 1 0 0 0 0 2h7a1 1 0 1 0 0-2H3zm0 4a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H3zm12-3a1 1 0 1 0-2 0v5.586l-1.293-1.293a1 1 0 0 0-1.414 1.414l3 3a1 1 0 0 0 1.414 0l3-3a1 1 0 0 0-1.414-1.414L15 13.586V8z" />
  </Svg>
);

export default SvgSortDescending;
