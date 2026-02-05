import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCreditCardCvv = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 4H4a2 2 0 0 0-2 2v3h20V5.999A2 2 0 0 0 20 4" />
    <Path
      fillRule="evenodd"
      d="M2 18v-7h20v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2m5-5a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCreditCardCvv;
