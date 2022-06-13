import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgTxStatusWarningCircle(props: SvgProps) {
  return (
    <Svg
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Path
        d="M0 28C0 12.536 12.536 0 28 0s28 12.536 28 28-12.536 28-28 28S0 43.464 0 28z"
        fill="#6B5600"
      />
      <Path
        d="M24 28h.01M28 28h.01M32 28h.01M37 28a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke="#FFD633"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default SvgTxStatusWarningCircle;
