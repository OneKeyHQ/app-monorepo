import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgQrcode = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M3 4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zm2 2V5h1v1H5zm-2 7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3zm2 2v-1h1v1H5zm8-12a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-3zm1 2v1h1V5h-1z"
      clipRule="evenodd"
    />
    <Path d="M11 4a1 1 0 1 0-2 0v1a1 1 0 0 0 2 0V4zm-1 3a1 1 0 0 1 1 1v1h2a1 1 0 1 1 0 2h-3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm6 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-7 4a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2v2a1 1 0 1 1-2 0v-3zm-2-2a1 1 0 1 0 0-2H4a1 1 0 1 0 0 2h3zm10 2a1 1 0 0 1-1 1h-2a1 1 0 1 1 0-2h2a1 1 0 0 1 1 1zm-1 4a1 1 0 1 0 0-2h-3a1 1 0 1 0 0 2h3z" />
  </Svg>
);

export default SvgQrcode;
