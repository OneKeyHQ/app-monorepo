import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEmail2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v.882l-10 5-10-5z" />
    <Path d="M2 9.118V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9.118l-9.106 4.553a2 2 0 0 1-1.788 0z" />
  </Svg>
);
export default SvgEmail2;
