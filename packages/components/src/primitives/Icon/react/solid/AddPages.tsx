import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddPages = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2zm10 2h-4a2 2 0 0 0-2 2v8H6V4h8zm1 6a1 1 0 1 0-2 0v1h-1a1 1 0 1 0 0 2h1v1a1 1 0 1 0 2 0v-1h1a1 1 0 1 0 0-2h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddPages;
