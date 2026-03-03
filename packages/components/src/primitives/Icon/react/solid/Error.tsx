import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgError = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23.256 20H.742L12 1.041zM11 15v2h2v-2zm0-6v5h2V9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgError;
