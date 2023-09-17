import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMore = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      d="M3.8 8a.9.9 0 1 1 1.8 0 .9.9 0 0 1-1.8 0ZM7.1 8a.9.9 0 1 1 1.8 0 .9.9 0 0 1-1.8 0ZM11.3 7.1a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z"
    />
  </Svg>
);
export default SvgMore;
