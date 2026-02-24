import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark1Small = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m17.378 7.682-6.197 9.914L6.587 13 8 11.586l2.818 2.818 4.864-7.782z" />
  </Svg>
);
export default SvgCheckmark1Small;
