import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgMenuAlt3 = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M3 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm0 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm6 5a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgMenuAlt3;
