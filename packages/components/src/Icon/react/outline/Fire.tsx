import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgFire = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.657 18.657A8 8 0 0 1 6.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0 1 20 13a7.975 7.975 0 0 1-2.343 5.657z"
    />
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.879 16.121A3 3 0 1 0 12.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
    />
  </Svg>
);

export default SvgFire;
