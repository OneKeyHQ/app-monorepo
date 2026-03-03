import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayout3Rows = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14v-3.33H5zm0-5.33h14v-3.34H5zm0-5.34h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayout3Rows;
