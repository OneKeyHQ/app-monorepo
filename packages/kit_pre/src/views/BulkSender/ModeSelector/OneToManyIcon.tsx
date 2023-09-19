import Svg, { G, Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const GroupIcon = (props: SvgProps) => (
  <Svg width="24" height="76" viewBox="0 0 24 76" fill="none" {...props}>
    <G id="Group 1">
      <Path id="Vector 1" d="M0 38H24" stroke="#4CC38A" stroke-width="1.54" />
      <Path
        id="Vector 2"
        d="M0 38V38C8.83656 38 16 30.8366 16 22V9C16 4.85786 19.3579 1.5 23.5 1.5V1.5"
        stroke="#4CC38A"
        stroke-width="1.54"
      />
      <Path
        id="Vector 3"
        d="M0 38V38C8.83656 38 16 45.1634 16 54V67C16 71.1421 19.3579 74.5 23.5 74.5V74.5"
        stroke="#4CC38A"
        stroke-width="1.54"
      />
    </G>
  </Svg>
);
export default GroupIcon;
