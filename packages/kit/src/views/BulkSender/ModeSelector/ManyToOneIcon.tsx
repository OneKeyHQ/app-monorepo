import Svg, { G, Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const GroupIcon = (props: SvgProps) => (
  <Svg width="24" height="76" viewBox="0 0 24 76" fill="none" {...props}>
    <G id="Group 2">
      <Path
        id="Vector 1"
        d="M24 38H-9.53674e-07"
        stroke="#4CC38A"
        stroke-width="1.54"
      />
      <Path
        id="Vector 2"
        d="M24 38V38C15.1634 38 8 30.8366 8 22V9C8 4.85786 4.64214 1.5 0.5 1.5V1.5"
        stroke="#4CC38A"
        stroke-width="1.54"
      />
      <Path
        id="Vector 3"
        d="M24 38V38C15.1634 38 8 45.1634 8 54V67C8 71.1421 4.64214 74.5 0.5 74.5V74.5"
        stroke="#4CC38A"
        stroke-width="1.54"
      />
    </G>
  </Svg>
);

export default GroupIcon;
