import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgArrowCircleDown(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 13l-3 3m0 0l-3-3m3 3V8m0 13a9 9 0 110-18 9 9 0 010 18z"
      />
    </Svg>
  );
}

export default SvgArrowCircleDown;
