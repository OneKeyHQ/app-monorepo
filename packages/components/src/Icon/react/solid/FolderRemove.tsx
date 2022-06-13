import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgFolderRemove(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      <Path
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 11h4"
      />
    </Svg>
  );
}

export default SvgFolderRemove;
