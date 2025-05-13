import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgApiConnection = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 22 18" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4 9a7 7 0 0 1 13.064-3.5 1 1 0 0 0 1.731-1A9.001 9.001 0 0 0 2.055 8H1a1 1 0 0 0 0 2h1.055a9.001 9.001 0 0 0 16.74 3.5 1 1 0 1 0-1.73-1A7 7 0 0 1 4 9"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11 4a5 5 0 1 0 4.9 6H21a1 1 0 1 0 0-2h-5.1A5 5 0 0 0 11 4M8 9a3 3 0 1 1 6 0 3 3 0 0 1-6 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgApiConnection;
