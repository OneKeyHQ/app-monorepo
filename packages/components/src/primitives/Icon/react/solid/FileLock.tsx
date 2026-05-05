import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileLock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7 13a3 3 0 0 1 3 3h1v6H3v-6h1a3 3 0 0 1 3-3m0 2a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1"
      clipRule="evenodd"
    />
    <Path d="M12 10h8v12h-7v-8h-1.416A5 5 0 0 0 4 12V2h8z" />
    <Path d="M19.414 8H14V2.586z" />
  </Svg>
);
export default SvgFileLock;
