import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgSwitchHorizontal(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </Svg>
  );
}

export default SvgSwitchHorizontal;
