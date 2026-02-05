import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraExposureLock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 19v-3a1 1 0 1 1 2 0v3h3a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2m16 0v-3a1 1 0 1 1 2 0v3a2 2 0 0 1-2 2h-3a1 1 0 1 1 0-2zm-9-5h4v-2h-4zM3 8V5a2 2 0 0 1 2-2h3a1 1 0 0 1 0 2H5v3a1 1 0 0 1-2 0m16 0V5h-3a1 1 0 1 1 0-2h3a2 2 0 0 1 2 2v3a1 1 0 1 1-2 0m-6 2a1 1 0 1 0-2 0zm2 .087a1.5 1.5 0 0 1 1 1.413v3a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 14.5v-3a1.5 1.5 0 0 1 1-1.413V10a3 3 0 1 1 6 0z" />
  </Svg>
);
export default SvgCameraExposureLock;
