import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGarage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 8.412V20H2V8.412l10-5.556zM8 18h8v-2H8zm0-4h8v-2H8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGarage;
