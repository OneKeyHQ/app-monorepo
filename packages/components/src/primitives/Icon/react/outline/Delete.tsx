import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDelete = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 2a5 5 0 0 1 4.583 3H21a1 1 0 1 1 0 2h-1.064l-.876 13.133A2 2 0 0 1 17.065 22H6.934a2 2 0 0 1-1.995-1.867L4.064 7H3a1 1 0 0 1 0-2h4.417A5 5 0 0 1 12 2M6.936 20h10.128l.867-13H6.069zM9 16v-5a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0m4 0v-5a1 1 0 1 1 2 0v5a1 1 0 1 1-2 0M12 4c-.887 0-1.685.387-2.234 1h4.468c-.55-.613-1.347-1-2.234-1" />
  </Svg>
);
export default SvgDelete;
