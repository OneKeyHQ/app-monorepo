import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgArrowSmLeft(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path
        fillRule="evenodd"
        d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export default SvgArrowSmLeft;
