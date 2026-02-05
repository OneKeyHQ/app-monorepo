import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCreditCard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 4h16a2 2 0 0 1 2 1.999V9H2V6a2 2 0 0 1 2-2m-2 7v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7z" />
  </Svg>
);
export default SvgCreditCard;
