import Svg, { Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckBoxIconDefault = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Rect width={8} height={2} x={4} y={7} fill="currentColor" rx={1} />
  </Svg>
);
export default SvgCheckBoxIconDefault;
