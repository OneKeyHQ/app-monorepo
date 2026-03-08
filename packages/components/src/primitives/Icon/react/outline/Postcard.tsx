import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPostcard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 14.5H6v-2h4zm8-.5h-4V9h4zm-6-3H6V9h6z" />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPostcard;
