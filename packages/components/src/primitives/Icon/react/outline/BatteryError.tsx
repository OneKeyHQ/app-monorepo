import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryError = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m13.914 10-2 2 2 2-1.414 1.414-2-2-2 2L7.086 14l2-2-2-2L8.5 8.586l2 2 2-2z" />
    <Path
      fillRule="evenodd"
      d="M20 8h3v8h-3v3H1V5h19zM3 17h15V7H3zm17-3h1v-4h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryError;
