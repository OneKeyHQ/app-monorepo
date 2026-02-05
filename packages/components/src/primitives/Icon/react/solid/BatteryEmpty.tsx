import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryEmpty = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M1 7a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v1h1.5A1.5 1.5 0 0 1 23 9.5v5a1.5 1.5 0 0 1-1.5 1.5H20v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2zm19 7h1v-4h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryEmpty;
