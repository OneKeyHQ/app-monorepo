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
      d="M21 3v5h2v14H12v-1H1v-6h2V3zm-7 17h7V10h-7zM3 19h9v-2H3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMultipleDevices;
