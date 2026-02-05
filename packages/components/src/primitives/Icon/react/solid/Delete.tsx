import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDelete = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7.416 5a5 5 0 0 1 9.168 0H21a1 1 0 1 1 0 2h-1.064l-.876 13.133A2 2 0 0 1 17.064 22H6.936a2 2 0 0 1-1.996-1.867L4.064 7H3a1 1 0 0 1 0-2zm2.348 0c.55-.614 1.348-1 2.236-1s1.687.386 2.236 1zM11 11a1 1 0 1 0-2 0v5a1 1 0 1 0 2 0zm3-1a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDelete;
