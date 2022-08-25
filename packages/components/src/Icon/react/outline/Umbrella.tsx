import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgUmbrella(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 23" fill="none" stroke="currentColor" {...props}>
      <Path
        d="M15 18V19.1c0 1.42-1.008 2.571-2.428 2.571A2.57 2.57 0 0110 19.098v-4.142m0-13.054a9 9 0 00-9 9h18a9 9 0 00-9-9z"
        strokeWidth={2}
        strokeMiterlimit={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default SvgUmbrella;
