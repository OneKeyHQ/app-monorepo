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
      d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zm-2-3.33H5V19h14zM5 10.33v3.34h14v-3.34zM5 5v3.33h14V5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayout3Rows;
