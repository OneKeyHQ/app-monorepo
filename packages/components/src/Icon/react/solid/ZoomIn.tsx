import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgZoomIn(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path d="M5 8a1 1 0 011-1h1V6a1 1 0 012 0v1h1a1 1 0 110 2H9v1a1 1 0 11-2 0V9H6a1 1 0 01-1-1z" />
      <Path
        fillRule="evenodd"
        d="M2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8zm6-4a4 4 0 100 8 4 4 0 000-8z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export default SvgZoomIn;
