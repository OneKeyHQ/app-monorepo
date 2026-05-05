import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraExposureLock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 19h4v2H3v-6h2zm16 2h-6v-2h4v-4h2z" />
    <Path
      fillRule="evenodd"
      d="M12 7a3 3 0 0 1 3 3h1v6H8v-6h1a3 3 0 0 1 3-3m0 2a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1"
      clipRule="evenodd"
    />
    <Path d="M9 5H5v4H3V3h6zm12 4h-2V5h-4V3h6z" />
  </Svg>
);
export default SvgCameraExposureLock;
