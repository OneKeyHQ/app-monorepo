import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDownloadSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM8 15v2h8v-2zm3-8v3.586l-1-1L8.586 11 12 14.414 15.414 11 14 9.586l-1 1V7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDownloadSquare;
