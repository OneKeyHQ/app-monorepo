import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgArrowSmUp(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 11l5-5m0 0l5 5m-5-5v12"
      />
    </Svg>
  );
}

export default SvgArrowSmUp;
