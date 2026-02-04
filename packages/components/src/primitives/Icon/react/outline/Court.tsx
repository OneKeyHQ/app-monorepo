import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCourt = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 19a1 1 0 0 1 0 2H4a1 1 0 1 1 0-2zM5 6.234V8h14V6.234l-7-2.186zM21 8.25A1.75 1.75 0 0 1 19.25 10H19v7a1 1 0 1 1-2 0v-7h-2v7a1 1 0 1 1-2 0v-7h-2v7a1 1 0 1 1-2 0v-7H7v7a1 1 0 1 1-2 0v-7h-.25A1.75 1.75 0 0 1 3 8.25V6.052A1.75 1.75 0 0 1 4.228 4.38l7.175-2.242a2 2 0 0 1 1.194 0l7.176 2.242A1.75 1.75 0 0 1 21 6.05z" />
  </Svg>
);
export default SvgCourt;
