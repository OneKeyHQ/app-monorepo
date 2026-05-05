import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWebcam = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M12 2a8 8 0 0 1 1 15.936V20h5v2H6v-2h5v-2.064A8 8 0 0 1 12 2m0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWebcam;
