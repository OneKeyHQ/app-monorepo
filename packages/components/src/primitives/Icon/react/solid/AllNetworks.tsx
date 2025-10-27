import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAllNetworks = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M15.333 13.998a1.335 1.335 0 1 1 0 2.67 1.335 1.335 0 0 1 0-2.67"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 0c6.627 0 12 5.373 12 12s-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0M8 12.668A2 2 0 0 0 6 14.666V16c0 1.103.895 1.997 1.998 1.998h1.334A2 2 0 0 0 11.33 16v-1.334a2 2 0 0 0-1.998-1.998zm7.333 0a2.665 2.665 0 1 0 0 5.33 2.665 2.665 0 0 0 0-5.33M7.999 6.001A2 2 0 0 0 6.001 8v1.334c0 1.103.895 1.998 1.998 1.998h1.334a2 2 0 0 0 1.998-1.998V7.999a2 2 0 0 0-1.998-1.998zm6.667 0A2 2 0 0 0 12.668 8v1.334c0 1.103.895 1.998 1.998 1.998H16a2 2 0 0 0 1.998-1.998V7.999A2 2 0 0 0 16 6.001z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAllNetworks;
