import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPassport = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.5 4.5v15h13v-15zm9 10.5a1 1 0 1 1 0 2h-5a1 1 0 1 1 0-2zm-1-4.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m2 0a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0m5 9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgPassport;
