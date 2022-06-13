import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgMinusSm(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path
        fillRule="evenodd"
        d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export default SvgMinusSm;
