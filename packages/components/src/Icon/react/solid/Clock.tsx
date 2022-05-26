import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgClock = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm1-12a1 1 0 1 0-2 0v4a1 1 0 0 0 .293.707l2.828 2.829a1 1 0 1 0 1.415-1.415L11 9.586V6z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgClock;
