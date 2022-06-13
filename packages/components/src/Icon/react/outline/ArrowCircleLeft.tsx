import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgArrowCircleLeft(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
      />
    </Svg>
  );
}

export default SvgArrowCircleLeft;
