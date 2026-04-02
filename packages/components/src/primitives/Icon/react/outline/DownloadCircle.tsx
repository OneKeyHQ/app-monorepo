import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDownloadCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 15v2H8v-2zm-5-8h2v3.586l1-1L15.414 11 12 14.414 8.586 11 10 9.586l1 1z" />
    <Path
      fillRule="evenodd"
      d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10m-2 0a8 8 0 1 0-16 0 8 8 0 0 0 16 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDownloadCircle;
