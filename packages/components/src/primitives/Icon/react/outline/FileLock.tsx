import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileLock = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 16a1 1 0 1 0-2 0zm-3 4h4v-2H5zm-1-9.5V4a2 2 0 0 1 2-2h7l.099.005a1 1 0 0 1 .608.288l6 6A1 1 0 0 1 20 9v11a2 2 0 0 1-2 2h-4a1 1 0 1 1 0-2h4V10h-4a2 2 0 0 1-2-2V4H6v6.5a1 1 0 1 1-2 0m6 5.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1 3 3 0 1 1 6 0m6.586-8L14 5.414V8z" />
  </Svg>
);
export default SvgFileLock;
