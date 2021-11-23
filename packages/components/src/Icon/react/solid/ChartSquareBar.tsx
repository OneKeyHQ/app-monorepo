import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgChartSquareBar(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path
        fillRule="evenodd"
        d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm9 4a1 1 0 10-2 0v6a1 1 0 102 0V7zm-3 2a1 1 0 10-2 0v4a1 1 0 102 0V9zm-3 3a1 1 0 10-2 0v1a1 1 0 102 0v-1z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export default SvgChartSquareBar;
