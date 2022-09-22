import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgConnectOff(props: SvgProps) {
  return (
    <Svg viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M10 16H7a4 4 0 01-1.5-7.71M15 12h-1M3 5l15 15M14 8h3a4 4 0 011.938 7.5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default SvgConnectOff;
