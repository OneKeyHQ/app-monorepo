import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgSortAscending = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 4h13M3 8h9m-9 4h6m4 0 4-4m0 0 4 4m-4-4v12"
    />
  </Svg>
);

export default SvgSortAscending;
