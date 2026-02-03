import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18.16 4.459a1 1 0 0 1 1.68 1.081l-9 14a1 1 0 0 1-1.622.084l-5-6.25a1 1 0 0 1 1.563-1.25l4.13 5.163 8.248-12.83Z" />
  </Svg>
);
export default SvgCheckmark1;
