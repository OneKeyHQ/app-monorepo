import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgArrowNarrowDown(props: SvgProps) {
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
        d="M16 17l-4 4m0 0l-4-4m4 4V3"
      />
    </Svg>
  );
}

export default SvgArrowNarrowDown;
