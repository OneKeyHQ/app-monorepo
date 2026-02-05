import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCursor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.002 3.09c-1.189-.423-2.336.724-1.912 1.912l5.776 16.21c.457 1.285 2.254 1.338 2.787.084l2.873-6.769 6.769-2.874c1.255-.533 1.202-2.33-.083-2.787z" />
  </Svg>
);
export default SvgCursor;
