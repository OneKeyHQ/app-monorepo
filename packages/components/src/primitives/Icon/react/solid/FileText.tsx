import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileText = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 10h8v12H4V2h8zm-4 9h8.5v-2H8zm0-4h5v-2H8z"
      clipRule="evenodd"
    />
    <Path d="M19.414 8H14V2.586z" />
  </Svg>
);
export default SvgFileText;
