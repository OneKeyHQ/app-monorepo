import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgMenuAlt1(props: SvgProps) {
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
        d="M4 6h16M4 12h8m-8 6h16"
      />
    </Svg>
  );
}

export default SvgMenuAlt1;
