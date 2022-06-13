import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgRestore(props: SvgProps) {
  return (
    <Svg viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M4 8c1.473-2.963 4.466-5 8-5a9 9 0 110 18 9.003 9.003 0 01-8.777-7M4 8V3m0 5h5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default SvgRestore;
