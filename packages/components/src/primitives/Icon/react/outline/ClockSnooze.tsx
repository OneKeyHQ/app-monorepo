import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgClockSnooze = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 12C2 6.477 6.477 2 12 2c1.167 0 2.29.2 3.333.57a1 1 0 0 1-.666 1.885 8 8 0 1 0 5.135 5.767 1 1 0 0 1 1.95-.444c.162.716.248 1.46.248 2.222 0 5.523-4.477 10-10 10S2 17.523 2 12m9-4a1 1 0 1 1 2 0v3.586l2.207 2.207a1 1 0 1 1-1.414 1.414l-2.5-2.5A1 1 0 0 1 11 12zm11-7a1 1 0 0 1 .8 1.6L20.999 5H22a1 1 0 1 1 0 2h-3a1 1 0 0 1-.8-1.6L20.001 3H19a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgClockSnooze;
