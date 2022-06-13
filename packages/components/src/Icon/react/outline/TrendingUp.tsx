import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgTrendingUp(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </Svg>
  );
}

export default SvgTrendingUp;
