import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPower = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.53 3.667A9.99 9.99 0 0 1 22 12c0 5.523-4.477 10-10 10S2 17.523 2 12a9.99 9.99 0 0 1 4.47-8.333l.833-.554L8.41 4.78l-.833.554a8 8 0 1 0 8.846 0l-.833-.554 1.107-1.666.833.554Z" />
    <Path d="M13 8h-2V1h2z" />
  </Svg>
);
export default SvgPower;
