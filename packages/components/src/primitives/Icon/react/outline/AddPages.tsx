import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddPages = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 11a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0v-1h-1a1 1 0 1 1 0-2h1v-1a1 1 0 0 1 1-1" />
    <Path
      fillRule="evenodd"
      d="M14 2a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm-4 18h8V8h-8zm-4-4h2V8a2 2 0 0 1 2-2h4V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddPages;
