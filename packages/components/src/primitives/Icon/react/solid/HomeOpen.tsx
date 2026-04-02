import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHomeOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21 8.524V21h-7v-7h-4v7H3V8.524l9-7.312z" />
  </Svg>
);
export default SvgHomeOpen;
