import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMusicPlaylist = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 15.5c0 2.096-1.97 3.5-4 3.5s-4-1.404-4-3.5 1.97-3.5 4-3.5c.7 0 1.393.167 2 .471V4.344l-8 2.4V18.5c0 2.096-1.97 3.5-4 3.5s-4-1.404-4-3.5S4.97 15 7 15c.7 0 1.393.167 2 .471V5.256l12-3.6z" />
  </Svg>
);
export default SvgMusicPlaylist;
