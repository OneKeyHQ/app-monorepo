import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMagicPencil = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.676 4.731 21.79 2.21l-2.522 6.114 4.289 5.036-6.596-.508-3.464 5.634-1.278-5.29L4 21.414 2.586 20l8.22-8.22-5.291-1.278 5.634-3.465-.51-6.595z" />
  </Svg>
);
export default SvgMagicPencil;
