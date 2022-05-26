import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgBookmark = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M5 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14l-5-2.5L5 18V4z" />
  </Svg>
);

export default SvgBookmark;
