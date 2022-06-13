import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgScan(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 5a2 2 0 012-2h3a1 1 0 010 2H5v3a1 1 0 01-2 0V5zm8-1a1 1 0 011-1h3a2 2 0 012 2v3a1 1 0 11-2 0V5h-3a1 1 0 01-1-1zm-7 7a1 1 0 011 1v3h3a1 1 0 110 2H5a2 2 0 01-2-2v-3a1 1 0 011-1zm12 0a1 1 0 011 1v3a2 2 0 01-2 2h-3a1 1 0 110-2h3v-3a1 1 0 011-1z"
      />
      <Path d="M7 7h6v6H7V7z" />
    </Svg>
  );
}

export default SvgScan;
