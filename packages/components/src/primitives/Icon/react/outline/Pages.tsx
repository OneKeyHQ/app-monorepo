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
      d="M14 2a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm-4 18h8V8h-8zm-4-4h2V8a2 2 0 0 1 2-2h4V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPages;
