import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgForward = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11.993 4.638c0-1.306 1.554-1.988 2.515-1.104l8.011 7.362a1.5 1.5 0 0 1 0 2.208l-8.01 7.362c-.962.884-2.516.201-2.516-1.105v-2.853c-3.418.054-5.325.392-6.512.932-1.196.545-1.733 1.325-2.406 2.637-.558 1.089-2.09.583-2.08-.515.043-4.131.7-7.247 2.68-9.287 1.83-1.886 4.589-2.65 8.318-2.76V4.637Z" />
  </Svg>
);
export default SvgForward;
