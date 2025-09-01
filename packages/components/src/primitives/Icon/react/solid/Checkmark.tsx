import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCheckmark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillOpacity={0.875}
      fillRule="evenodd"
      d="M14.421 2.025a1 1 0 0 1 .22 1.397l-7.636 10.5a1 1 0 0 1-1.427.198l-4.03-3.167A1 1 0 0 1 2.785 9.38l3.214 2.526 7.026-9.66a1 1 0 0 1 1.397-.221"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCheckmark;
