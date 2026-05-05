import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTrade = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.5 21h-2V11h2zM5 17H3V7h2zm16 0h-2V7h2zm-10.5-4h-2V3h2z" />
  </Svg>
);
export default SvgTrade;
