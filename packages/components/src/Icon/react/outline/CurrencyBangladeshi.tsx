import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgCurrencyBangladeshi(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 11V9a2 2 0 00-2-2m2 4v4a2 2 0 104 0v-1m-4-3H9m2 0h4m6 1a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </Svg>
  );
}

export default SvgCurrencyBangladeshi;
