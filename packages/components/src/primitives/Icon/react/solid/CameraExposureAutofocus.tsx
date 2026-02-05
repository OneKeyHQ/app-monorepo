import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraExposureAutofocus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 15a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2v-3a1 1 0 0 1 1-1m16 0a1 1 0 0 1 1 1v3a2 2 0 0 1-2 2h-3a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1" />
    <Path
      fillRule="evenodd"
      d="M12 8.25a1 1 0 0 1 .91.586l2.5 5.5a1 1 0 0 1-1.82.828l-.415-.914h-2.349l-.416.914a1 1 0 1 1-1.82-.828l2.5-5.5A1 1 0 0 1 12 8.25m-.265 4h.53L12 11.667z"
      clipRule="evenodd"
    />
    <Path d="M8 3a1 1 0 0 1 0 2H5v3a1 1 0 0 1-2 0V5a2 2 0 0 1 2-2zm11 0a2 2 0 0 1 2 2v3a1 1 0 1 1-2 0V5h-3a1 1 0 1 1 0-2z" />
  </Svg>
);
export default SvgCameraExposureAutofocus;
