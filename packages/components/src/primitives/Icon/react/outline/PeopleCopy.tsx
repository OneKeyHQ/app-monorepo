import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleCopy = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 16a5.5 5.5 0 0 1 5.291 4H20V8H8v12h.709A5.5 5.5 0 0 1 14 16m0 2a3.5 3.5 0 0 0-3.16 2h6.32A3.5 3.5 0 0 0 14 18m1-5.5a1 1 0 1 0-2 0 1 1 0 0 0 2 0m2 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0M4 4v12h2V8a2 2 0 0 1 2-2h8V4zm14 2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgPeopleCopy;
