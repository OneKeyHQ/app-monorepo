import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHandPointer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.788 2c1.238 0 2.242.995 2.242 2.223v4.444h5.607C19.494 8.667 21 10.159 21 12v2.032c0 4.4-3.6 7.968-8.04 7.968a8.05 8.05 0 0 1-7.114-4.257L2.5 11.444l.842-1.042a2.256 2.256 0 0 1 3.151-.347l1.053.834V4.223A2.233 2.233 0 0 1 9.788 2" />
  </Svg>
);
export default SvgHandPointer;
