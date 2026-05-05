import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTextIndicator = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M22 4h-2v16h2v2h-6v-2h2V4h-2V2h6zm-8 3H9v12H7V7H2V5h12z" />
  </Svg>
);
export default SvgTextIndicator;
