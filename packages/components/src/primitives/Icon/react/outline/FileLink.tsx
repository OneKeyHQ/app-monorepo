import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 18a1 1 0 1 1 2 0 2 2 0 1 0 4 0 1 1 0 1 1 2 0 4 4 0 0 1-8 0m3-1v-1a1 1 0 1 1 2 0v1a1 1 0 1 1-2 0m3-2a2 2 0 1 0-4 0 1 1 0 1 1-2 0 4 4 0 0 1 8 0 1 1 0 1 1-2 0M4 8V4a2 2 0 0 1 2-2h7l.099.005a1 1 0 0 1 .608.288l6 6A1 1 0 0 1 20 9v11a2 2 0 0 1-2 2h-5.5a1 1 0 1 1 0-2H18V10h-4a2 2 0 0 1-2-2V4H6v4a1 1 0 0 1-2 0m12.586 0L14 5.414V8z" />
  </Svg>
);
export default SvgFileLink;
