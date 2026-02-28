import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolder2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 11v9H2v-9zm-9.586-6H22v4H2V3h8.414z" />
  </Svg>
);
export default SvgFolder2;
