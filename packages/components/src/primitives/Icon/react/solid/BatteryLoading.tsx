import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBatteryLoading = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3 5h8.5l-4.8 6.4a1 1 0 0 0 .8 1.6h4L7 19H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2" />
    <Path
      fillRule="evenodd"
      d="M18 19H9.5l4.8-6.4a1 1 0 0 0-.8-1.6h-4L14 5h4a2 2 0 0 1 2 2v1h1.5A1.5 1.5 0 0 1 23 9.5v5a1.5 1.5 0 0 1-1.5 1.5H20v1a2 2 0 0 1-2 2m2-5h1v-4h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryLoading;
