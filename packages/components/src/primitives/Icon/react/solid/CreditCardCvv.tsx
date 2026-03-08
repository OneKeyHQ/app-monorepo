import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCreditCardCvv = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 20H2v-9h20zM6 15h5v-2H6z"
      clipRule="evenodd"
    />
    <Path d="M22 4v5H2V4z" />
  </Svg>
);
export default SvgCreditCardCvv;
