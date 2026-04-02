import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlusSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM11 11H8v2h3v3h2v-3h3v-2h-3V8h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPlusSquare;
