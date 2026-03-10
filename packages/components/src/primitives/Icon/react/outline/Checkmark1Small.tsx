import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark1Small = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m17.378 7.682-6.196 9.914L6.586 13 8 11.586l2.817 2.817 4.865-7.78z" />
  </Svg>
);
export default SvgCheckmark1Small;
