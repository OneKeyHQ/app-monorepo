import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m23.415 10.628-3.914 3.914-1.12-1.12-3.149 6.648-.233.491-.539.073-12.613 1.67L3.506 9.066l7.201-3.318-1.105-1.106L13.516.728zm-18.063-.21-.998 7.955 3.72-3.72a2 2 0 1 1 1.427 1.401l-3.707 3.708 7.863-1.04 3.223-6.801-4.665-4.665zm7.078-5.776 7.071 7.072 1.086-1.086-7.071-7.071z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPen;
