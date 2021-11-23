import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgSwitchVertical(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
      />
    </Svg>
  );
}

export default SvgSwitchVertical;
