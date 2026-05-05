import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThumbtack = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.5 2v4.997a6.25 6.25 0 0 0 1.831 4.419l.669.67V16h-7v6h-2v-6H4v-3.914l.669-.67A6.25 6.25 0 0 0 6.5 6.997V2z" />
  </Svg>
);
export default SvgThumbtack;
