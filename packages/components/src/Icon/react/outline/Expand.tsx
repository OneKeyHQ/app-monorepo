import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgExpand(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="none" {...props}>
      <Path
        d="M11.667 3.334h4.167c.46 0 .833.373.833.833v4.167m-8.334 8.333H4.168a.833.833 0 01-.833-.833v-4.167"
        stroke="#8C8CA1"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default SvgExpand;
