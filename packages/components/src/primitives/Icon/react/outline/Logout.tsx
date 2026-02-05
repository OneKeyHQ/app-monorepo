import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLogout = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 19V5a2 2 0 0 1 2-2h6.25a1 1 0 1 1 0 2H5v14h6.25a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2M14.793 6.793a1 1 0 0 1 1.414 0l4.5 4.5a1 1 0 0 1 0 1.414l-4.5 4.5a1 1 0 1 1-1.414-1.414L17.586 13H8.75a1 1 0 1 1 0-2h8.836l-2.793-2.793a1 1 0 0 1 0-1.414" />
  </Svg>
);
export default SvgLogout;
