import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessagePlus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.002 3h14a2 2 0 0 1 2 2v12.036a2 2 0 0 1-2 2h-3.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-3.65a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M13 8a1 1 0 1 0-2 0v2H9a1 1 0 0 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessagePlus;
