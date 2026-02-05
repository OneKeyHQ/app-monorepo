import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoClapperboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm16 5V6h-2.18l-.6 3zm-4.82 0 .6-3h-2.46l-.6 3zm-4.5 0 .6-3H8.82l-.6 3zm-4.5 0 .6-3H4v3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoClapperboard;
