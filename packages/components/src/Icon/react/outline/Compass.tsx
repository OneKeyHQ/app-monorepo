import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgCompass(props: SvgProps) {
  return (
    <Svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Path
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.937 9.903l5.599-1.356-1.415 5.657-5.656 1.414 1.472-5.715z"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default SvgCompass;
