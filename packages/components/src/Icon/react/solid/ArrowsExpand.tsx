import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgArrowsExpand = (props: SvgProps) => (
  <Svg viewBox="0 0 19 20" fill="currentColor" {...props}>
    <Path
      stroke="#374151"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 8V4m0 0h4M3 4l4 4m8 0V4m0 0h-4m4 0-4 4m-8 4v4m0 0h4m-4 0 4-4m8 4-4-4m4 4v-4m0 4h-4"
    />
  </Svg>
);

export default SvgArrowsExpand;
