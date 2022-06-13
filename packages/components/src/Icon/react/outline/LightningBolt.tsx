import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgLightningBolt(props: SvgProps) {
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
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </Svg>
  );
}

export default SvgLightningBolt;
