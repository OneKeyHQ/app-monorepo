import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgFastForward(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
    </Svg>
  );
}

export default SvgFastForward;
