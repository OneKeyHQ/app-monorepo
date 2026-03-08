import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAutoPageSize = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 22H4V2h16zM6 20h5v-7H6zm0-9h7v9h5V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAutoPageSize;
