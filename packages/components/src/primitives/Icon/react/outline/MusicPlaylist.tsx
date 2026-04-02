import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMusicPlaylist = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.996 15.5c0 2.096-1.97 3.5-4 3.5s-4-1.404-4-3.5 1.97-3.5 4-3.5c.7 0 1.393.166 2 .47V4.345l-8 2.4V18.5c0 2.096-1.97 3.5-4 3.5s-4-1.404-4-3.5 1.97-3.5 4-3.5c.7 0 1.393.166 2 .47V5.257l12-3.6zm-14 1.5c-1.283 0-2 .835-2 1.5s.717 1.5 2 1.5 2-.835 2-1.5-.717-1.5-2-1.5m10-3c-1.283 0-2 .835-2 1.5 0 .666.717 1.5 2 1.5s2-.835 2-1.5-.717-1.5-2-1.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMusicPlaylist;
