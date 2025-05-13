import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgQrCode = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm3-1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM3 16a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm3-1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1zM16 3a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zm-1 3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M14 13a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1m3 1a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1m0 4a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0zm-3 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2"
    />
  </Svg>
);
export default SvgQrCode;
