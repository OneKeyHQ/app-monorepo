import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPostcard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 4v16H2V4zM6 12.5v2h4v-2zm8 1.5h4V9h-4zm-8-3h6V9H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPostcard;
