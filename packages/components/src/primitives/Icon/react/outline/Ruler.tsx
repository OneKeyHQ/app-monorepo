import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRuler = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.485 2.391c.75-.75 1.967-.75 2.717 0l4.407 4.407c.75.75.75 1.967 0 2.717L9.515 21.61c-.75.75-1.967.75-2.717 0L2.39 17.202a1.92 1.92 0 0 1 0-2.717zm-.646 3.363.522.522a.96.96 0 0 1-1.359 1.359l-.522-.522-2.004 2.004L11.96 10.6a.96.96 0 0 1-1.359 1.359l-1.483-1.483-2.004 2.004.522.522a.96.96 0 0 1-1.359 1.359l-.522-.522-2.004 2.005 4.406 4.406L20.25 8.157 15.844 3.75z" />
  </Svg>
);
export default SvgRuler;
