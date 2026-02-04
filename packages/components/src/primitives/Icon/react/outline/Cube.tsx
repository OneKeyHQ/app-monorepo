import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCube = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m18.895 9.252-5.91 3.324v6.605l5.91-3.325zM6.128 7.567 12 10.87l5.87-3.303L12 4.265zm4.887 11.614v-6.605l-5.91-3.324v6.604zm9.85-3.325a1.97 1.97 0 0 1-1.004 1.718l-6.895 3.878a1.97 1.97 0 0 1-1.932 0L4.14 17.574a1.97 1.97 0 0 1-1.005-1.718V8.143A1.97 1.97 0 0 1 4.14 6.426l6.895-3.878a1.97 1.97 0 0 1 1.932 0l6.895 3.878a1.97 1.97 0 0 1 1.005 1.717v7.713Z" />
  </Svg>
);
export default SvgCube;
