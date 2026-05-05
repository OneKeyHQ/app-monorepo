import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoClapperboard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 20H2V10h20zM6.5 8H2V4h6.1zm7.247 0H8.653l1.6-4h5.094zM22 8h-6.1l1.6-4H22z" />
  </Svg>
);
export default SvgVideoClapperboard;
