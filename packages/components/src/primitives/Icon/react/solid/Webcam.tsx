import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWebcam = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4" />
    <Path
      fillRule="evenodd"
      d="M12 2a8 8 0 0 1 1 15.939V20h5v2H6v-2h5v-2.061A8.002 8.002 0 0 1 12 2m0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWebcam;
