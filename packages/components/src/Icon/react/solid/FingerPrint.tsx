import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgFingerPrint = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M6.625 2.655A9 9 0 0 1 19 11a1 1 0 1 1-2 0 7 7 0 0 0-9.625-6.492 1 1 0 1 1-.75-1.853zM4.662 4.959A1 1 0 0 1 4.75 6.37 6.97 6.97 0 0 0 3 11a1 1 0 1 1-2 0 8.97 8.97 0 0 1 2.25-5.953 1 1 0 0 1 1.412-.088z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M5 11a5 5 0 1 1 10 0 1 1 0 1 1-2 0 3 3 0 1 0-6 0c0 1.677-.345 3.276-.968 4.729a1 1 0 1 1-1.838-.789A9.964 9.964 0 0 0 5 11zm8.921 2.012a1 1 0 0 1 .831 1.145 19.86 19.86 0 0 1-.545 2.436 1 1 0 1 1-1.92-.558c.207-.713.371-1.445.49-2.192a1 1 0 0 1 1.144-.83z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M10 10a1 1 0 0 1 1 1c0 2.236-.46 4.368-1.29 6.304a1 1 0 0 1-1.838-.789A13.952 13.952 0 0 0 9 11a1 1 0 0 1 1-1z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgFingerPrint;
