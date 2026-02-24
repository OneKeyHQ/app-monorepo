import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPencil = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 11.914 7.914 22H2v-5.914L12.086 6zM22.414 7.5l-3 3L13.5 4.586l3-3z" />
  </Svg>
);
export default SvgPencil;
