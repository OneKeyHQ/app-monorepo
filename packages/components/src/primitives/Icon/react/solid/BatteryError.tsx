import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryError = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-1h1.5a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 21.5 8H20V7a2 2 0 0 0-2-2zm17 5v4h1v-4zM7.793 9.293a1 1 0 0 1 1.414 0l1.293 1.293 1.293-1.293a1 1 0 1 1 1.414 1.414L11.914 12l1.293 1.293a1 1 0 0 1-1.414 1.414L10.5 13.414l-1.293 1.293a1 1 0 0 1-1.414-1.414L9.086 12l-1.293-1.293a1 1 0 0 1 0-1.414"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryError;
