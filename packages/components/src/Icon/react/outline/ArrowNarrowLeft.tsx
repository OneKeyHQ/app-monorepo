import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgArrowNarrowLeft(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16l-4-4m0 0l4-4m-4 4h18"
      />
    </Svg>
  );
}

export default SvgArrowNarrowLeft;
