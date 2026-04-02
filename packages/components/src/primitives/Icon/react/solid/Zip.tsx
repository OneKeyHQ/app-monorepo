import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgZip = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 16a1 1 0 1 1-2 0v-1h2z" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM9 16a3 3 0 1 0 6 0v-3H9zm0-7v2h6V9zm0-2h6V5H9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgZip;
