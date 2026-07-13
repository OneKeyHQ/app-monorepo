import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEmailSparkle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m19.4 14 1 2.6 2.6 1v.8l-2.6 1-1 2.6h-.8l-1-2.6-2.6-1v-.8l2.6-1 1-2.6z" />
    <Path d="m22 15.071-.053-.02L20.773 12h-3.546l-1.175 3.052L13 16.227V20H2V5.963l10 7.273 10-7.273z" />
    <Path d="M12 10.764 2.7 4h18.6z" />
  </Svg>
);
export default SvgEmailSparkle;
