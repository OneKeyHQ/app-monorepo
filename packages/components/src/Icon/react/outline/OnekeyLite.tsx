import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgOnekeyLite(props: SvgProps) {
  return (
    <Svg viewBox="0 0 24 24" fill="none" {...props}>
      <Path
        d="M7 11a1 1 0 100 2v-2zm1 2a1 1 0 100-2v2zm-1 1a1 1 0 100 2v-2zm5 2a1 1 0 100-2v2zm5-8a1 1 0 100 2V8zm.01 2a1 1 0 000-2v2zM6 6h12V4H6v2zm14 2v8h2V8h-2zm-2 10H6v2h12v-2zM4 16V8H2v8h2zm2 2a2 2 0 01-2-2H2a4 4 0 004 4v-2zm14-2a2 2 0 01-2 2v2a4 4 0 004-4h-2zM18 6a2 2 0 012 2h2a4 4 0 00-4-4v2zM6 4a4 4 0 00-4 4h2a2 2 0 012-2V4zm1 9h1v-2H7v2zm0 3h5v-2H7v2zm10-6h.01V8H17v2z"
        fill="currentColor"
      />
    </Svg>
  );
}

export default SvgOnekeyLite;
