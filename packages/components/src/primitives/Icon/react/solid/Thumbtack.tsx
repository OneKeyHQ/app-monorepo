import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThumbtack = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.5 2a2 2 0 0 0-2 2v2.997a6.25 6.25 0 0 1-1.83 4.42l-.377.376A1 1 0 0 0 4 12.5V14a2 2 0 0 0 2 2h5v5a1 1 0 1 0 2 0v-5h5a2 2 0 0 0 2-2v-1.5a1 1 0 0 0-.293-.707l-.376-.377a6.25 6.25 0 0 1-1.831-4.42V4a2 2 0 0 0-2-2z" />
  </Svg>
);
export default SvgThumbtack;
