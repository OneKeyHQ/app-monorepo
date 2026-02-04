import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBubbles = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8m16.5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M15 9.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0m-.5 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M10 17.5a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBubbles;
