import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCreditCardCvv = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 11H4v7h16zm-10 2a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2zm12 5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 1.999zM4 9h16V6H4z" />
  </Svg>
);
export default SvgCreditCardCvv;
