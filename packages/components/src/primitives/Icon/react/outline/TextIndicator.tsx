import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTextIndicator = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 2a1 1 0 1 1 0 2h-1v16h1a1 1 0 1 1 0 2h-4a1 1 0 1 1 0-2h1V4h-1a1 1 0 1 1 0-2zM7 18V7H3a1 1 0 0 1 0-2h10a1 1 0 1 1 0 2H9v11a1 1 0 1 1-2 0" />
  </Svg>
);
export default SvgTextIndicator;
