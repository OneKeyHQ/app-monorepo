import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgMenuAlt4(props: SvgProps) {
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
        d="M4 8h16M4 16h16"
      />
    </Svg>
  );
}

export default SvgMenuAlt4;
