import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSchool = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 16v2h2v-2zm7-6v8h2v-8zM4 18h2v-8H4zM8 6v12h1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2h1V6zm10 2h2a2 2 0 0 1 2 2v8a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2v-8a2 2 0 0 1 2-2h2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgSchool;
