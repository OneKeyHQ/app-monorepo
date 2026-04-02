import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAirplay = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18.08 20.999H5.92l6.081-7.6 6.08 7.6Z" />
    <Path d="M22 18h-4.5v-2H20V5H4v11h2.5v2H2V3h20z" />
  </Svg>
);
export default SvgAirplay;
