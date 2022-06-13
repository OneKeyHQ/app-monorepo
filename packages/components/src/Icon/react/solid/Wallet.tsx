import * as React from 'react';

import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgWallet = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M2.48721 2.69172C2.85394 2.26804 3.39567 2 4 2H16C17.1046 2 18 2.89543 18 4V12C18 13.1046 17.1046 14 16 14H13V16C13 16.7145 12.6188 17.3748 12 17.7321C11.3812 18.0893 10.6188 18.0893 10 17.732L3.34713 13.891C2.56314 13.6204 2 12.876 2 12V4C2 3.49976 2.18365 3.04242 2.48721 2.69172ZM13 12H16V4H8L12 6.3094C12.6188 6.66667 13 7.32692 13 8.04145V12ZM9 12C9.55228 12 10 11.5523 10 11C10 10.4477 9.55228 10 9 10C8.44772 10 8 10.4477 8 11C8 11.5523 8.44772 12 9 12Z"
    />
  </Svg>
);

export default SvgWallet;
