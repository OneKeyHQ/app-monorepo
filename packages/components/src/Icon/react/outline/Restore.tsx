import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgRestore(props: SvgProps) {
  return (
    <Svg viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M4 13.04a8 8 0 10.5-4m-.5-5v5h5"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default SvgRestore;
