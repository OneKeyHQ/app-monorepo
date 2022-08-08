import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgWallet(props: SvgProps) {
  return (
    <Svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <Path
        d="M11.5 13a.5.5 0 110 1 .5.5 0 010-1"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.663 3.827l10.098 2.87a3.48 3.48 0 012.393 3.231v9.995a1.894 1.894 0 01-2.4 2L5.4 19.654A3.416 3.416 0 013 16.46V5.597A2.54 2.54 0 015.465 3h12.766A2.77 2.77 0 0121 5.77v8.264a2.84 2.84 0 01-2.871 2.813h-1.976M21 9.923h-4.846"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default SvgWallet;
