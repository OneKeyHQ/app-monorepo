import * as React from 'react';
import Svg, { SvgProps, Rect } from 'react-native-svg';

function SvgCheckBoxIconDefaultDisable(props: SvgProps) {
  return (
    <Svg viewBox="0 0 16 16" fill="none" {...props}>
      <Rect x={4} y={7} width={8} height={2} rx={1} fill="currentColor" />
    </Svg>
  );
}

export default SvgCheckBoxIconDefaultDisable;
