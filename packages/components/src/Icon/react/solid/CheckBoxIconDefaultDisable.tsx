import * as React from 'react';
import Svg, { SvgProps, Rect } from 'react-native-svg';

function SvgCheckBoxIconDefaultDisable(props: SvgProps) {
  return (
    <Svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <Rect x={4} y={7} width={8} height={2} rx={1} fill="#48485B" />
    </Svg>
  );
}

export default SvgCheckBoxIconDefaultDisable;
