import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPencil = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.129 2.957a2 2 0 0 1 2.828 0l3.086 3.086a2 2 0 0 1 0 2.828l-1.586 1.586-5.914-5.914zm-3 3-9.5 9.5a2 2 0 0 0-.586 1.414v3.086a2 2 0 0 0 2 2h3.086a2 2 0 0 0 1.414-.586l9.5-9.5z" />
  </Svg>
);
export default SvgPencil;
