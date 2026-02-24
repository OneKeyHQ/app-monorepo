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
      d="M20 5v3h3v8h-3v3H1V5zm-9.5 5.586-2-2L7.086 10l2 2-2 2L8.5 15.414l2-2 2 2L13.914 14l-2-2 2-2L12.5 8.586zM20 14h1v-4h-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBatteryError;
