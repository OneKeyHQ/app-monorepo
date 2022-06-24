import * as React from 'react';
import Svg, { SvgProps, Circle } from 'react-native-svg';

function SvgNotificationIndicator(props: SvgProps) {
  return (
    <Svg viewBox="0 0 12 12" fill="none" {...props}>
      <Circle
        cx={6}
        cy={6}
        r={5}
        fill="#33C641"
        stroke="#1D1D2A"
        strokeWidth={2}
      />
    </Svg>
  );
}

export default SvgNotificationIndicator;
