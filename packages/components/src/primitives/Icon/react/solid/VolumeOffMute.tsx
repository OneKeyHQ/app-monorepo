import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeOffMute = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.293 3.293a1 1 0 1 1 1.414 1.414l-16 16a1 1 0 1 1-1.414-1.414l2.616-2.616A2 2 0 0 1 5 15V9a2 2 0 0 1 2-2h2.698l5.748-3.832A1 1 0 0 1 17 4v1.586zM17 20a1 1 0 0 1-1.555.832l-4.82-3.214L17 11.243z" />
  </Svg>
);
export default SvgVolumeOffMute;
