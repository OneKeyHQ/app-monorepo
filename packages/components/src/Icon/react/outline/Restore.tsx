import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgRestore = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M4 8c1.473-2.963 4.466-5 8-5a9 9 0 1 1 0 18 9.003 9.003 0 0 1-8.777-7M4 8V3m0 5h5"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default SvgRestore;
