import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCreditCardPlus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 13v3h3v2h-3v3h-2v-3h-3v-2h3v-3z" />
    <Path d="M16 14h-3v6H2v-9h14zm6-5H2V4h20z" />
  </Svg>
);
export default SvgCreditCardPlus;
