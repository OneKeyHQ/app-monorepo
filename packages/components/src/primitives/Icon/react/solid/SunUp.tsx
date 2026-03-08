import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSunUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 21H2v-2h20zM5 17H2v-2h3zm7-6a5 5 0 0 1 5 5v1H7v-1a5 5 0 0 1 5-5m10 6h-3v-2h3zM7.278 10.734l-1.285 1.533-2.298-1.93 1.285-1.53zm13.025-.396-2.3 1.929-1.284-1.533 2.298-1.927zM16.414 5 15 6.414l-2-2V9h-2V4.414l-2 2L7.586 5 12 .586z" />
  </Svg>
);
export default SvgSunUp;
