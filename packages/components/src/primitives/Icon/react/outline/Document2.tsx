import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocument2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 16H8v-2h4zm4-4H8v-2h8zm0-4H8V6h8z" />
    <Path
      fillRule="evenodd"
      d="M20 22H4V2h16zM6 20h12V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDocument2;
