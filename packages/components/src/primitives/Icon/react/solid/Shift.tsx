import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShift = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.348 2.377a2 2 0 0 0-2.697 0L1.73 10.523C.38 11.754 1.252 14 3.078 14H6v5a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-5h2.922c1.825 0 2.697-2.246 1.348-3.477l-8.92-8.146Z" />
  </Svg>
);
export default SvgShift;
