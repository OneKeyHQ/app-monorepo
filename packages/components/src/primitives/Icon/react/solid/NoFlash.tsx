import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNoFlash = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m14.134 17.91-4.136 5.65v-7.638H2.223l3.919-5.116zm-.136-10.363h7.722l-5.213 7.122 5.158 4.583-1.33 1.496-18-16 1.33-1.496 4.916 4.37L13.998.55z" />
  </Svg>
);
export default SvgNoFlash;
