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
      d="M7 13a3 3 0 0 1 3 3h1v6H3v-6h1a3 3 0 0 1 3-3m-2 7h4v-2H5zm2-5a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M20 8.586V22h-7v-2h5V10h-6V4H6v7H4V2h9.414zM14 8h2.586L14 5.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFileLock;
