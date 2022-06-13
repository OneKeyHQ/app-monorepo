import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgImport(props: SvgProps) {
  return (
    <Svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      {...props}
    >
      <Path
        d="M11.707 7.293a1 1 0 10-1.414 1.414l1.414-1.414zM15 12l.707.707.707-.707-.707-.707L15 12zm-4.707 3.293a1 1 0 101.414 1.414l-1.414-1.414zM3 11a1 1 0 100 2v-2zm1-3a1 1 0 002 0H4zm2 8a1 1 0 10-2 0h2zm4.293-7.293l4 4 1.414-1.414-4-4-1.414 1.414zm4 2.586l-4 4 1.414 1.414 4-4-1.414-1.414zM15 11H3v2h12v-2zM7 4h11V2H7v2zm12 1v14h2V5h-2zm-1 15H7v2h11v-2zM6 8V5H4v3h2zm0 11v-3H4v3h2zm1 1a1 1 0 01-1-1H4a3 3 0 003 3v-2zm12-1a1 1 0 01-1 1v2a3 3 0 003-3h-2zM18 4a1 1 0 011 1h2a3 3 0 00-3-3v2zM7 2a3 3 0 00-3 3h2a1 1 0 011-1V2z"
        fill="#8C8CA1"
      />
    </Svg>
  );
}

export default SvgImport;
