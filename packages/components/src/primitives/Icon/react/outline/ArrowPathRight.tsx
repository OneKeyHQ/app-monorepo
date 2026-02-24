import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowPathRight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23.519 12 13 21.204V16H2V8h11V2.796zM15 10H4v4h11v2.796L20.48 12 15 7.203z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowPathRight;
