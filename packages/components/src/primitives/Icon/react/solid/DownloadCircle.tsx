import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDownloadCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2M8 15v2h8v-2zm3-8v3.586l-1-1L8.586 11 12 14.414 15.414 11 14 9.586l-1 1V7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDownloadCircle;
