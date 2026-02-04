import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDownload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 19v-4a1 1 0 1 1 2 0v4h14v-4a1 1 0 1 1 2 0v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2m8-15a1 1 0 1 1 2 0v8.086l1.793-1.793a1 1 0 1 1 1.414 1.414l-3.5 3.5a1 1 0 0 1-1.414 0l-3.5-3.5a1 1 0 1 1 1.414-1.414L11 12.086z" />
  </Svg>
);
export default SvgDownload;
