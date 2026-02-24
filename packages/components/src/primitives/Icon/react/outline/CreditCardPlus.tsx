import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCreditCardPlus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 16h3v2h-3v3h-2v-3h-3v-2h3v-3h2z" />
    <Path
      fillRule="evenodd"
      d="M22 11H4v7h9v2H2V4h20zM4 9h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCreditCardPlus;
