import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgMinus = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 12H4"
    />
  </Svg>
);

export default SvgMinus;
