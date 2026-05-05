import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocument2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 22H4V2h16zM8 16h4v-2H8zm0-4h8v-2H8zm0-4h8V6H8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocument2;
