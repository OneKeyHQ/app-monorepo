import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgChevronDoubleLeft(props: SvgProps) {
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
        d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
      />
    </Svg>
  );
}

export default SvgChevronDoubleLeft;
