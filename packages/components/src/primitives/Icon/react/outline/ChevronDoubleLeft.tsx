import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChevronDoubleLeft = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9.364 16.669a.992.992 0 0 0 1.403-1.403L7.5 12l3.267-3.266A.992.992 0 0 0 9.364 7.33l-3.441 3.442a1.735 1.735 0 0 0 0 2.454l3.441 3.442Zm6.943 0a.992.992 0 1 0 1.402-1.403L14.443 12l3.266-3.266a.992.992 0 0 0-1.402-1.403l-3.441 3.442a1.736 1.736 0 0 0 0 2.454z" />
  </Svg>
);
export default SvgChevronDoubleLeft;
