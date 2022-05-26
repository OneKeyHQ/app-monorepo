import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgChevronRight = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 0 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgChevronRight;
