import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgInput = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 16h-2V8h2zm-9-5.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m4 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgInput;
