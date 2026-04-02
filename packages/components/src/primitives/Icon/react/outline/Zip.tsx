import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgZip = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 5H5v14h14V5h-2V3h4v18H3V3h4z" />
    <Path
      fillRule="evenodd"
      d="M15 14a3 3 0 1 1-6 0v-3h6zm-4 0a1 1 0 1 0 2 0v-1h-2z"
      clipRule="evenodd"
    />
    <Path d="M15 9H9V7h6zm0-4H9V3h6z" />
  </Svg>
);
export default SvgZip;
