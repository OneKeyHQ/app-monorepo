import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilter1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 14.414A2 2 0 0 1 13.586 13L19 7.586V5H5v2.586L10.414 13A2 2 0 0 1 11 14.414v5.643l2-.75zm8-6.828A2 2 0 0 1 20.414 9L15 14.414v4.893a2 2 0 0 1-1.298 1.873l-2 .75A2 2 0 0 1 9 20.057v-5.643L3.586 9A2 2 0 0 1 3 7.586V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgFilter1;
