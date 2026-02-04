import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryMedium = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-1h1.5a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 21.5 8H20V7a2 2 0 0 0-2-2zm17 5v4h1v-4zM6 9a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1m5.5 1a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryMedium;
