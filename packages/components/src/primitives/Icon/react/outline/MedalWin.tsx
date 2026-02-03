import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMedalWin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.979 16.308c-.92.372-1.925.58-2.979.58a7.9 7.9 0 0 1-2.979-.58v4.185l2.313-1.156a1.5 1.5 0 0 1 1.171-.069l.161.07 2.313 1.155zm2.979-7.364a5.958 5.958 0 1 0-11.916 0 5.958 5.958 0 0 0 11.916 0m1.986 0a7.93 7.93 0 0 1-2.98 6.198v6.155a1.49 1.49 0 0 1-2.155 1.332L12 21.224 9.19 22.63a1.49 1.49 0 0 1-2.155-1.332v-6.155a7.944 7.944 0 1 1 12.909-6.198Z" />
  </Svg>
);
export default SvgMedalWin;
