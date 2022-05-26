import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgRss = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 0 1 7 7m-6 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"
    />
  </Svg>
);

export default SvgRss;
