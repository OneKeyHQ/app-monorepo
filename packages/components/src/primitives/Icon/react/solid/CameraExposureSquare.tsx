import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraExposureSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 5a2 2 0 0 1 2-2h3a1 1 0 0 1 0 2H5v3a1 1 0 0 1-2 0zm12-1a1 1 0 0 1 1-1h3a2 2 0 0 1 2 2v3a1 1 0 1 1-2 0V5h-3a1 1 0 0 1-1-1M4 15a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2v-3a1 1 0 0 1 1-1m16 0a1 1 0 0 1 1 1v3a2 2 0 0 1-2 2h-3a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1M10 8a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z" />
  </Svg>
);
export default SvgCameraExposureSquare;
