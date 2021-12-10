import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgCheckBoxIconChecked(props: SvgProps) {
  return (
    <Svg width={16} height={16} fill="none" {...props}>
      <Path
        d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z"
        fill="#fff"
      />
    </Svg>
  );
}

export default SvgCheckBoxIconChecked;
