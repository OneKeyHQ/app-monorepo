import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgMenuAlt3(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16m-7 6h7"
      />
    </Svg>
  );
}

export default SvgMenuAlt3;
