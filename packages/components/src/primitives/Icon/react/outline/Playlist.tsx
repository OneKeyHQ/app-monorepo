import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPlaylist = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m21.998 17.5-.006.194C21.875 19.682 19.965 21 17.998 21c-2.03 0-4-1.404-4-3.5s1.97-3.5 4-3.5c.7 0 1.393.166 2 .47V4h2zm-4-1.5c-1.283 0-2 .835-2 1.5s.717 1.5 2 1.5 2-.835 2-1.5-.717-1.5-2-1.5"
      clipRule="evenodd"
    />
    <Path d="M10 19H2v-2h8zm2-6H2v-2h10zm5-6H2V5h15z" />
  </Svg>
);
export default SvgPlaylist;
