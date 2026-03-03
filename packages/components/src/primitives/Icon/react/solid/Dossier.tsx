import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDossier = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 10h14v10H2V4h6z" />
    <Path d="M15 8h-5V4h5zm7 0h-5V4h5z" />
  </Svg>
);
export default SvgDossier;
