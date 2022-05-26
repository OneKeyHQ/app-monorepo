import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgChevronLeft = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M12.707 5.293a1 1 0 0 1 0 1.414L9.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgChevronLeft;
