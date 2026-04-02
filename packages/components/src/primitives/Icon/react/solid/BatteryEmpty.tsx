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
      d="M20 8h3v8h-3v3H1V5h19zm0 6h1v-4h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryEmpty;
