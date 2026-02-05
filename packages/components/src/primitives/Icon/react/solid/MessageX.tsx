import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageX = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M5.002 3h14a2 2 0 0 1 2 2v12.036a2 2 0 0 1-2 2h-3.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-3.65a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m9.705 6.707a1 1 0 0 0-1.414-1.414L12 9.586l-1.293-1.293a1 1 0 0 0-1.414 1.414L10.586 11l-1.293 1.293a1 1 0 1 0 1.414 1.414L12 12.414l1.293 1.293a1 1 0 0 0 1.414-1.414L13.414 11z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageX;
