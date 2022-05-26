import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgLockOpen = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M10 2a5 5 0 0 0-5 5v2a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H7V7a3 3 0 0 1 5.905-.75 1 1 0 0 0 1.937-.5A5.002 5.002 0 0 0 10 2z" />
  </Svg>
);

export default SvgLockOpen;
