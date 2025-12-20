import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryFull = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h13a3 3 0 0 0 3-3h1a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-1a3 3 0 0 0-3-3zm16 5v4h1v-4zM6 9a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1m5.5 1a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0zM15 9a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-4a1 1 0 0 1 1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryFull;
