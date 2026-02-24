import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryLoading = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.5 13h6L7 19H1V5h10.5z" />
    <Path
      fillRule="evenodd"
      d="M20 8h3v8h-3v3H9.5l6-8h-6L14 5h6zm0 6h1v-4h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryLoading;
