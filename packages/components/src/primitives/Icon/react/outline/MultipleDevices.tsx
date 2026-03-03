import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMultipleDevices = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M19 19h-3v-2h3z" />
    <Path
      fillRule="evenodd"
      d="M21 8h2v14H12v-1H1v-6h2V3h18zm-7 12h7V10h-7zM3 17v2h9v-2zm2-2h7V8h7V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMultipleDevices;
