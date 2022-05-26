import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgScissors = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14.121 14.121 19 19m-7-7 7-7m-7 7-2.879 2.879M12 12 9.121 9.121m0 5.758a3 3 0 1 0-4.243 4.243 3 3 0 0 0 4.243-4.243zm0-5.758a3 3 0 1 0-4.243-4.243 3 3 0 0 0 4.243 4.243z"
    />
  </Svg>
);

export default SvgScissors;
