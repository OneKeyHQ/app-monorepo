import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgInbox = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M5 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgInbox;
