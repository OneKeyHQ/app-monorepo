import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSchool = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 4a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v8a1 1 0 1 1 0 2H2a1 1 0 1 1 0-2v-8a2 2 0 0 1 2-2h2V6a2 2 0 0 1 2-2zM4 18h2v-8H4zm6 0h4v-3h-4zm8 0h2v-8h-2z" />
  </Svg>
);
export default SvgSchool;
