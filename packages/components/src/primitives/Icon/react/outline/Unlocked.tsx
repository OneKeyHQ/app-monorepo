import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUnlocked = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 11v9h12v-9zm5 6v-3a1 1 0 1 1 2 0v3a1 1 0 1 1-2 0m9 3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1V7a5 5 0 0 1 9.843-1.249 1 1 0 0 1-1.938.498A3.002 3.002 0 0 0 9 7v2h9a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgUnlocked;
