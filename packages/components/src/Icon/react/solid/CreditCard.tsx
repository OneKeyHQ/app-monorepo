import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgCreditCard(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
      <Path
        fillRule="evenodd"
        d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
        clipRule="evenodd"
      />
    </Svg>
  );
}

export default SvgCreditCard;
