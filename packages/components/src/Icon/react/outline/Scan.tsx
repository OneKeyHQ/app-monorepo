import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgScan(props: SvgProps) {
  return (
    <Svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <Path d="M10 9h4V7h-4v2zm5 1v4h2v-4h-2zm-1 5h-4v2h4v-2zm-5-1v-4H7v4h2zm1 1a1 1 0 01-1-1H7a3 3 0 003 3v-2zm5-1a1 1 0 01-1 1v2a3 3 0 003-3h-2zm-1-5a1 1 0 011 1h2a3 3 0 00-3-3v2zm-4-2a3 3 0 00-3 3h2a1 1 0 011-1V7zM5 9V6H3v3h2zm0 9v-3H3v3h2zm14-3v3h2v-3h-2zm0-9v3h2V6h-2zM6 5h3V3H6v2zm9 0h3V3h-3v2zM9 19H6v2h3v-2zm9 0h-3v2h3v-2zM3 18a3 3 0 003 3v-2a1 1 0 01-1-1H3zm16 0a1 1 0 01-1 1v2a3 3 0 003-3h-2zm2-12a3 3 0 00-3-3v2a1 1 0 011 1h2zM5 6a1 1 0 011-1V3a3 3 0 00-3 3h2z" />
    </Svg>
  );
}

export default SvgScan;
