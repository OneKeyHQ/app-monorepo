import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShareArrow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.986 4.639c0-1.306 1.553-1.988 2.515-1.105l8.011 7.362a1.5 1.5 0 0 1 0 2.209l-8.01 7.361c-.963.884-2.516.202-2.516-1.104v-2.854c-3.418.054-5.325.393-6.512.933-1.197.544-1.734 1.324-2.407 2.637-.558 1.088-2.09.583-2.079-.516.043-4.13.7-7.246 2.68-9.287 1.83-1.886 4.588-2.65 8.318-2.76z" />
  </Svg>
);
export default SvgShareArrow;
