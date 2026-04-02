import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowCornerDownRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      stroke="#000"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeOpacity={0.267}
      strokeWidth={1.333}
      d="M2.666 3.334v5.333c0 .736.597 1.333 1.333 1.333h8.667m-2-2.666L13.333 10l-2.667 2.667"
    />
  </Svg>
);
export default SvgArrowCornerDownRight;
