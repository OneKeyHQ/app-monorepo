import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDelete = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7.417 5a5 5 0 0 1 9.168 0H21a1 1 0 1 1 0 2h-1.064l-.814 12.2A3 3 0 0 1 16.13 22H7.87a3 3 0 0 1-2.993-2.8L4.064 7H3a1 1 0 0 1 0-2zm2.348 0c.55-.614 1.348-1 2.236-1s1.687.386 2.236 1zM11 11a1 1 0 1 0-2 0v5a1 1 0 1 0 2 0zm3-1a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDelete;
