import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPages = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16 2v4h4v16H8v-4H4V2zM6 16h2V6h6V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPages;
