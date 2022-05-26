import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgChevronUp = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M14.707 12.707a1 1 0 0 1-1.414 0L10 9.414l-3.293 3.293a1 1 0 0 1-1.414-1.414l4-4a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1 0 1.414z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgChevronUp;
