import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlaylist = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21.998 17.5c0 2.096-1.97 3.5-4 3.5s-4-1.404-4-3.5 1.97-3.5 4-3.5c.7 0 1.393.167 2 .472V4h2zM10 17v2H2v-2zm2-4H2v-2h10zm5-6H2V5h15z" />
  </Svg>
);
export default SvgPlaylist;
