import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayers2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M23.118 15.144 12.06 21.288 1 15.144l3.44-1.912 7.56 4.2 7.618-4.232z" />
    <Path d="M23.06 9 12 15.144.941 9l11.06-6.144z" />
  </Svg>
);
export default SvgLayers2;
