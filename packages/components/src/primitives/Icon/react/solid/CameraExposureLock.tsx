import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraExposureLock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 3a2 2 0 0 0-2 2v3a1 1 0 0 0 2 0V5h3a1 1 0 0 0 0-2zm11 0a1 1 0 1 0 0 2h3v3a1 1 0 1 0 2 0V5a2 2 0 0 0-2-2zM5 16a1 1 0 1 0-2 0v3a2 2 0 0 0 2 2h3a1 1 0 1 0 0-2H5zm16 0a1 1 0 1 0-2 0v3h-3a1 1 0 1 0 0 2h3a2 2 0 0 0 2-2z" />
    <Path
      fillRule="evenodd"
      d="M15 10.085V10a3 3 0 1 0-6 0v.085A1.5 1.5 0 0 0 8 11.5v3A1.5 1.5 0 0 0 9.5 16h5a1.5 1.5 0 0 0 1.5-1.5v-3a1.5 1.5 0 0 0-1-1.415M11 10h2a1 1 0 1 0-2 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraExposureLock;
