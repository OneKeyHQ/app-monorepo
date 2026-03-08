import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCc = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zm-9.129 6.879a3 3 0 1 0 0 4.242l-1.414-1.414a1 1 0 1 1 0-1.414zm5.5 0a3 3 0 1 0 0 4.242l-1.414-1.414a1 1 0 1 1 0-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCc;
