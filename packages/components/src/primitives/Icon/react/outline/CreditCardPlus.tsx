import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCreditCardPlus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 20v-2h-2a1 1 0 1 1 0-2h2v-2a1 1 0 1 1 2 0v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0M2 18V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 1.999V10a1 1 0 0 1-1 1H4v7h8a1 1 0 1 1 0 2H4a2 2 0 0 1-2-2m2-9h16V6H4z" />
  </Svg>
);
export default SvgCreditCardPlus;
