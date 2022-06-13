import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgCheck(props: SvgProps) {
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
        d="M5 13l4 4L19 7"
      />
    </Svg>
  );
}

export default SvgCheck;
