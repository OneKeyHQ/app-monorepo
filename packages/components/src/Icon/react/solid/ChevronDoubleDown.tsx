import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgChevronDoubleDown = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M15.707 4.293a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 1.414-1.414L10 8.586l4.293-4.293a1 1 0 0 1 1.414 0zm0 6a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L10 14.586l4.293-4.293a1 1 0 0 1 1.414 0z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgChevronDoubleDown;
