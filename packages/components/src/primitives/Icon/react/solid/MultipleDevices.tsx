import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMultipleDevices = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 17.5a1 1 0 1 0 0 2h1a1 1 0 1 0 0-2z" />
    <Path
      fillRule="evenodd"
      d="M5 3a2 2 0 0 0-2 2v10H2a1 1 0 0 0-1 1v3a2 2 0 0 0 2 2h9.268A2 2 0 0 0 14 22h7a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2V5a2 2 0 0 0-2-2zm7 14H3v2h9zm2 3h7V10h-7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMultipleDevices;
