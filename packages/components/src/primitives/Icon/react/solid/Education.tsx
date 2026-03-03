import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEducation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19.501 17.3 12 21.118 4.501 17.3v-4.5l7.5 3.82 7.5-3.82z" />
    <Path d="M24 9v8h-2v-6.98l-10 5.103L0 9l12-6.123z" />
  </Svg>
);
export default SvgEducation;
