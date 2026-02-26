import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeOffMute = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.414 4 4 21.414 2.586 20l3-3H5V7h4.746L17 3.071v2.515l3-3zM10.253 9H7v6h.586L15 7.586V6.429z"
      clipRule="evenodd"
    />
    <Path d="m17 20.93-6.282-3.404 1.474-1.475L15 17.57v-4.328l2-2z" />
  </Svg>
);
export default SvgVolumeOffMute;
