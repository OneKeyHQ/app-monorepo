import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlaylist = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.998 17.5c0-.666-.717-1.5-2-1.5s-2 .834-2 1.5.717 1.5 2 1.5 2-.834 2-1.5M9 17a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm2-6a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm5-6a1 1 0 1 1 0 2H3a1 1 0 0 1 0-2zm5.998 12.5c0 2.096-1.97 3.5-4 3.5s-4-1.404-4-3.5 1.97-3.5 4-3.5c.7 0 1.393.166 2 .47V5a1 1 0 0 1 2 0z" />
  </Svg>
);
export default SvgPlaylist;
