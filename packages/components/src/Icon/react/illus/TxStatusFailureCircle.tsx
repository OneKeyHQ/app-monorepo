import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgTxStatusFailureCircle(props: SvgProps) {
  return (
    <Svg
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Path
        d="M0 28C0 12.536 12.536 0 28 0s28 12.536 28 28-12.536 28-28 28S0 43.464 0 28z"
        fill="#6B1914"
      />
      <Path
        d="M28 24v4m0 4h.01M37 28a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke="#FF6259"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default SvgTxStatusFailureCircle;
