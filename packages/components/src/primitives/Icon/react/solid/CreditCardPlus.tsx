import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCreditCardPlus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 4h16a2 2 0 0 1 2 1.999V9H2V6a2 2 0 0 1 2-2m-2 7v7a2 2 0 0 0 2 2h12a3 3 0 1 1 0-6 3 3 0 0 1 3-3z" />
    <Path d="M20 14a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2z" />
  </Svg>
);
export default SvgCreditCardPlus;
