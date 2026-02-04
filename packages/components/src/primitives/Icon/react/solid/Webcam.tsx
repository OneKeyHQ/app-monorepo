import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWebcam = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4" />
    <Path
      fillRule="evenodd"
      d="M12 2a8 8 0 0 0-1 15.938V20H7a1 1 0 1 0 0 2h10a1 1 0 1 0 0-2h-4v-2.062A8.001 8.001 0 0 0 12 2m-4 8a4 4 0 1 1 8 0 4 4 0 0 1-8 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWebcam;
