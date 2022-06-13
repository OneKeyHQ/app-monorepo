import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgArrowUp(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 10l7-7m0 0l7 7m-7-7v18"
      />
    </Svg>
  );
}

export default SvgArrowUp;
