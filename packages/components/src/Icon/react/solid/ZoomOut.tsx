import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgZoomOut(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path
        fillRule="evenodd"
        d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
        clipRule="evenodd"
      />
      <Path
        fillRule="evenodd"
        d="M5 8a1 1 0 011-1h4a1 1 0 110 2H6a1 1 0 01-1-1z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export default SvgZoomOut;
