import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgChevronUp(props: SvgProps) {
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
        d="M5 15l7-7 7 7"
      />
    </Svg>
  );
}

export default SvgChevronUp;
