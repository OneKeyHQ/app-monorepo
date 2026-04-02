import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLookGlasses = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 7a4.99 4.99 0 0 0-4 2H0v2h1.1a5 5 0 1 0 9.601-.705A3 3 0 0 1 12 10c.466 0 .906.106 1.299.295A5 5 0 1 0 22.9 11H24V9h-2a5 5 0 0 0-4-2c-1.442 0-2.74.61-3.652 1.585A5 5 0 0 0 12 8a5 5 0 0 0-2.348.585A4.99 4.99 0 0 0 6 7" />
  </Svg>
);
export default SvgLookGlasses;
