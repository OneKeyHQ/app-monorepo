import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlaylist = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M21.998 5a1 1 0 1 0-2 0v9.471a4.5 4.5 0 0 0-2-.471c-2.03 0-4 1.404-4 3.5s1.97 3.5 4 3.5 4-1.404 4-3.5zM3 5a1 1 0 0 0 0 2h13a1 1 0 1 0 0-2zm0 6a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2zm0 6a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2z"
    />
  </Svg>
);
export default SvgPlaylist;
