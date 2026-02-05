import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgClockAlert = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-9-4a1 1 0 1 1 2 0v3.586l2.207 2.207a1 1 0 1 1-1.414 1.414l-2.5-2.5A1 1 0 0 1 11 12zM4.293 1.543a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 1 1-1.414-1.414zm14 0a1 1 0 0 1 1.414 0l3 3a1 1 0 1 1-1.414 1.414l-3-3a1 1 0 0 1 0-1.414M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgClockAlert;
