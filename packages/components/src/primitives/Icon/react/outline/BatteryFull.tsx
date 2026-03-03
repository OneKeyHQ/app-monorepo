import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryFull = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 15H5V9h2zm4.5 0h-2V9h2zm4.5 0h-2V9h2z" />
    <Path
      fillRule="evenodd"
      d="M20 8h3v8h-3v3H1V5h19zM3 17h15V7H3zm17-3h1v-4h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryFull;
