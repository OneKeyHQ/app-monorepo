import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCopy1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16 8h6v14H8v-6H2V2h14zm-6 12h10V10H10zm-6-6h4V8h6V4H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCopy1;
