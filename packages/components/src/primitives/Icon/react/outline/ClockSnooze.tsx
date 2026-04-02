import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgClockSnooze = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 2a9.9 9.9 0 0 1 4.445 1.04l-.89 1.791A7.94 7.94 0 0 0 12 4a8 8 0 1 0 7.556 5.364l1.888-.659A10 10 0 0 1 22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2" />
    <Path d="m13 11.586 2.914 2.914-1.414 1.414-3.5-3.5V7h2zM23 2.62l-.241.28-1.8 2.1H23v2h-5V5.38l.241-.28 1.8-2.1H18V1h5z" />
  </Svg>
);
export default SvgClockSnooze;
