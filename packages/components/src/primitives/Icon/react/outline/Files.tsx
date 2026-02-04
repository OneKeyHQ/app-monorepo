import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFiles = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.172 2q.265.002.52.048a1 1 0 0 1 1.196.494q.216.15.405.337l3.828 3.828a3 3 0 0 1 .336.404 1 1 0 0 1 .494 1.196q.047.256.049.521V17a2 2 0 0 1-2 2h-1v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a2 2 0 0 1 2-2zM6 20h10v-1H9a2 2 0 0 1-2-2V7H6zm3-3h10V9h-3a2 2 0 0 1-2-2V4H9zm7-10h1.586L16 5.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFiles;
