import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryLow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 5v3h3v8h-3v3H1V5zM5 9v6h2V9zm15 5h1v-4h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryLow;
