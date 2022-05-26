import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgChevronLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m15 19-7-7 7-7"
    />
  </Svg>
);

export default SvgChevronLeft;
