import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark2Small = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 20 20" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M14.715 6.04c.347.302.382.829.079 1.175L8.96 13.882a.834.834 0 0 1-1.216.04l-2.5-2.5a.833.833 0 1 1 1.179-1.178l1.87 1.87 5.247-5.996a.833.833 0 0 1 1.175-.079"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckmark2Small;
