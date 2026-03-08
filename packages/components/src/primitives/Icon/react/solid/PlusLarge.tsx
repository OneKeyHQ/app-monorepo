import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlusLarge = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 11h8v2h-8v8h-2v-8H3v-2h8V3h2z" />
  </Svg>
);
export default SvgPlusLarge;
