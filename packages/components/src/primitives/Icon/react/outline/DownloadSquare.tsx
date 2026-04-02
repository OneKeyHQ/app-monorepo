import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDownloadSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 17H8v-2h8zm-3-6.414 1-1L15.414 11 12 14.414 8.586 11 10 9.586l1 1V7h2z" />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDownloadSquare;
