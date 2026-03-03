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
      d="M3 4h20v14h-3v2H6v-2H3zm15 13H8v1h10zM2 8v6H0V8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVisionProApp;
