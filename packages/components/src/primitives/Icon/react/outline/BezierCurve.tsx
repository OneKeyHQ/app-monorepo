import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierCurve = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 16v2h2v-2zm16 0v2h2v-2zM11 6v2h2V6zm8.27 0A1.998 1.998 0 0 1 23 7a2 2 0 0 1-3.73 1h-1.615a8.98 8.98 0 0 1 3.288 6H21a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2c0-1.08.857-1.96 1.929-1.997a7.01 7.01 0 0 0-4.03-5.377A2 2 0 0 1 13 10h-2a2 2 0 0 1-1.9-1.374 7.01 7.01 0 0 0-4.03 5.377A2 2 0 0 1 7 16v2a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h.057a8.98 8.98 0 0 1 3.288-6H4.73A1.998 1.998 0 0 1 1 7a2 2 0 0 1 3.73-1H9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgBezierCurve;
