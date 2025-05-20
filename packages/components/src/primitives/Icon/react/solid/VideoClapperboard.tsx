import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoClapperboard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3zm2 0a1 1 0 0 1 1-1h1.78l-.6 3H4zm16 2V7a1 1 0 0 0-1-1h-1.18l-.6 3zm-4.82 0 .6-3h-2.46l-.6 3zm-4.5 0 .6-3H8.82l-.6 3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoClapperboard;
