import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCodeLines = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 18a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm11 0a1 1 0 1 1 0 2h-6a1 1 0 1 1 0-2zM8 11a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm13 0a1 1 0 1 1 0 2h-8a1 1 0 1 1 0-2zm-8-7a1 1 0 1 1 0 2H3a1 1 0 0 1 0-2zm8 0a1 1 0 1 1 0 2h-3a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgCodeLines;
