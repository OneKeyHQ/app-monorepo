import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMusicPlaylist = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 4.173a2 2 0 0 0-2.575-1.916l-8 2.4A2 2 0 0 0 9 6.573V15.3a4.5 4.5 0 0 0-2-.471c-2.03 0-4 1.404-4 3.5s1.97 3.5 4 3.5 4-1.404 4-3.5V6.573l8-2.4V12.3a4.5 4.5 0 0 0-2-.471c-2.03 0-4 1.404-4 3.5s1.97 3.5 4 3.5 4-1.404 4-3.5z" />
  </Svg>
);
export default SvgMusicPlaylist;
