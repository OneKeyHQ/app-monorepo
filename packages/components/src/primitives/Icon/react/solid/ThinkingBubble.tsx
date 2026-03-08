import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThinkingBubble = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.75 16.5a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5M13 2a4 4 0 0 1 3.48 2.026 5 5 0 0 1 2.912 9.365 5 5 0 0 1-6.353 2.21A4 4 0 0 1 6 13a5 5 0 0 1 3.52-8.974A4 4 0 0 1 13.002 2Z" />
  </Svg>
);
export default SvgThinkingBubble;
