import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayout2Rows = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zM5 19h14v-6H5zm0-8h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLayout2Rows;
