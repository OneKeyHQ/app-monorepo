import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHomeSimple = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.261 1.755a2 2 0 0 0-2.522 0l-7 5.688A2 2 0 0 0 3 8.995V19.02a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.995a2 2 0 0 0-.739-1.552z" />
  </Svg>
);
export default SvgHomeSimple;
