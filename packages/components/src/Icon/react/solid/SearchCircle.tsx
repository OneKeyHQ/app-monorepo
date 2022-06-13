import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgSearchCircle(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" />
      <Path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export default SvgSearchCircle;
