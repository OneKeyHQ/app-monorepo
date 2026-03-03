import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowPathLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11 8h11v8H11v5.204L.481 12 11 2.796zm-7.481 4L9 16.796V14h11v-4H9V7.203z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowPathLeft;
