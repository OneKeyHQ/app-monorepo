import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChecklist = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m9.9 13.8-4.168 5.557-3.119-2.08 1.11-1.663 1.545 1.03L8.3 12.6zM21 17h-9v-2h9zM9.9 5.8l-4.168 5.557-3.119-2.08 1.11-1.663 1.545 1.03L8.3 4.6zM21 9h-9V7h9z" />
  </Svg>
);
export default SvgChecklist;
