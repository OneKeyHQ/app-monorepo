import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMusicPlaylist = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 18.328c0-.665-.717-1.5-2-1.5s-2 .835-2 1.5c0 .666.717 1.5 2 1.5s2-.834 2-1.5m10-3c0-.665-.717-1.5-2-1.5s-2 .835-2 1.5c0 .666.717 1.5 2 1.5s2-.834 2-1.5m2 0c0 2.096-1.97 3.5-4 3.5s-4-1.404-4-3.5 1.97-3.5 4-3.5c.7 0 1.393.167 2 .471V4.173l-8 2.4v11.755c0 2.096-1.97 3.5-4 3.5s-4-1.404-4-3.5 1.97-3.5 4-3.5c.7 0 1.393.167 2 .471V6.573a2 2 0 0 1 1.425-1.915l8-2.4A2 2 0 0 1 21 4.172v11.155Z" />
  </Svg>
);
export default SvgMusicPlaylist;
