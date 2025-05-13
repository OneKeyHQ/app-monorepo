import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgZip = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M11 16v-1h2v1a1 1 0 1 1-2 0" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3m4 2a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2zm-1 5a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1m1 3a1 1 0 0 0-1 1v2a3 3 0 1 0 6 0v-2a1 1 0 0 0-1-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgZip;
