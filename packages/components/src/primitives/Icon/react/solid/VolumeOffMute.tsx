import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeOffMute = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21.414 4 4 21.414 2.586 20l3-3H5V7h4.746L17 3.071v2.515l3-3zM17 20.93l-6.282-3.404L17 11.243z" />
  </Svg>
);
export default SvgVolumeOffMute;
