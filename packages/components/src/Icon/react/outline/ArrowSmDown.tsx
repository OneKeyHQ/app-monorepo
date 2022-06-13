import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgArrowSmDown(props: SvgProps) {
  return (
    <Svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      {...props}
    >
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 13l-5 5m0 0l-5-5m5 5V6"
      />
    </Svg>
  );
}

export default SvgArrowSmDown;
