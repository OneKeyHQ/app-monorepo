import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraExposureCross = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 3a2 2 0 0 0-2 2v3a1 1 0 0 0 2 0V5h3a1 1 0 0 0 0-2zm11 0a1 1 0 1 0 0 2h3v3a1 1 0 1 0 2 0V5a2 2 0 0 0-2-2zM5 16a1 1 0 1 0-2 0v3a2 2 0 0 0 2 2h3a1 1 0 1 0 0-2H5zm16 0a1 1 0 1 0-2 0v3h-3a1 1 0 1 0 0 2h3a2 2 0 0 0 2-2zM10.586 9.172a1 1 0 0 0-1.414 1.414L10.586 12l-1.414 1.414a1 1 0 1 0 1.414 1.414L12 13.414l1.414 1.414a1 1 0 0 0 1.414-1.414L13.414 12l1.414-1.414a1 1 0 0 0-1.414-1.414L12 10.586z" />
  </Svg>
);
export default SvgCameraExposureCross;
