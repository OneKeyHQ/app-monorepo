import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierCurve = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M15 6h4.27A1.998 1.998 0 0 1 23 7a2 2 0 0 1-3.73 1h-1.616a8.98 8.98 0 0 1 3.29 6H23v6h-6v-6h1.929A7 7 0 0 0 15 8.675V10H9V8.675A7 7 0 0 0 5.071 14H7v6H1v-6h2.057a8.98 8.98 0 0 1 3.29-6H4.73A1.998 1.998 0 0 1 1 7a2 2 0 0 1 3.73-1H9V4h6zM3 18h2v-2H3zm16 0h2v-2h-2zM11 8h2V6h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBezierCurve;
