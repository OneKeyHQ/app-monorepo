import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVisionProApp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M23 18h-3v2H6v-2H3V4h20zM8 18h10v-1H8zm-3-2h1v-1h14v1h1V6H5z"
      clipRule="evenodd"
    />
    <Path d="M2 14H0V8h2z" />
  </Svg>
);
export default SvgVisionProApp;
