import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBezierCurve = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.5 4A1.5 1.5 0 0 0 9 5.5V6H4.732a2 2 0 1 0 0 2h1.61a8.99 8.99 0 0 0-3.287 6H2.5A1.5 1.5 0 0 0 1 15.5v3A1.5 1.5 0 0 0 2.5 20h3A1.5 1.5 0 0 0 7 18.5v-3A1.5 1.5 0 0 0 5.5 14h-.43a7.01 7.01 0 0 1 3.94-5.331A1.5 1.5 0 0 0 10.5 10h3a1.5 1.5 0 0 0 1.49-1.331A7.01 7.01 0 0 1 18.93 14h-.43a1.5 1.5 0 0 0-1.5 1.5v3a1.5 1.5 0 0 0 1.5 1.5h3a1.5 1.5 0 0 0 1.5-1.5v-3a1.5 1.5 0 0 0-1.5-1.5h-.555a8.99 8.99 0 0 0-3.288-6h1.61A2 2 0 0 0 23 7a2 2 0 0 0-3.732-1H15v-.5A1.5 1.5 0 0 0 13.5 4z" />
  </Svg>
);
export default SvgBezierCurve;
