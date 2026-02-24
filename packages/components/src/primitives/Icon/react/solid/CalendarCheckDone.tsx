import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCalendarCheckDone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m22.405 15.844-5.322 6.653L13.586 19 15 17.586l1.917 1.917 3.927-4.908z" />
    <Path d="M9 2v2h6V2h2v2h4v9h-2v-3H5v9h7v2H3V4h4V2z" />
  </Svg>
);
export default SvgCalendarCheckDone;
