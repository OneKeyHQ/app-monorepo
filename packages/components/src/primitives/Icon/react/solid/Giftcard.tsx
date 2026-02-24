import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGiftcard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m10.086 14.5 1.414 1.414 1.5-1.5V20H2v-7h9.586zM22 20h-7v-5.586l1.5 1.5 1.414-1.414-1.5-1.5H22zM13 9.586l-1.5-1.5L10.086 9.5l1.5 1.5H2V4h11zM22 4v7h-5.586l1.5-1.5L16.5 8.086l-1.5 1.5V4z" />
  </Svg>
);
export default SvgGiftcard;
