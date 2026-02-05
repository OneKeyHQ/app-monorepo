import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrowser = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2m2 1a1 1 0 1 1 2 0 1 1 0 0 1-2 0m4-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2" />
    <Path
      fillRule="evenodd"
      d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm2 0h16v4H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBrowser;
