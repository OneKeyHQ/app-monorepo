import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgConsole = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM6.086 8l1.75 1.75-1.75 1.75L7.5 12.914l3.164-3.164L7.5 6.586zM11 10.5v2h4v-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgConsole;
