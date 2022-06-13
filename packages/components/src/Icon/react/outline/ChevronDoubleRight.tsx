import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgChevronDoubleRight(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 5l7 7-7 7M5 5l7 7-7 7"
      />
    </Svg>
  );
}

export default SvgChevronDoubleRight;
