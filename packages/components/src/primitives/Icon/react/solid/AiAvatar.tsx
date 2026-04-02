import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAiAvatar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 5H5v14h2.1a5.002 5.002 0 0 1 9.8 0H19v-7h2v9H3V3h9z" />
    <Path d="M12 7.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6M20 4l3 1.5L20 7l-1.5 3L17 7l-3-1.5L17 4l1.5-3z" />
  </Svg>
);
export default SvgAiAvatar;
