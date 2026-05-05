import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryLoading = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13.4 5.8 9.5 11h6l-6.3 8.4-1.6-1.2 3.9-5.2h-6l6.3-8.4z" />
    <Path d="M8 7H3v10h2.5v2H1V5h7z" />
    <Path
      fillRule="evenodd"
      d="M20 8h3v8h-3v3h-7v-2h5V7h-2.5V5H20zm0 6h1v-4h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryLoading;
