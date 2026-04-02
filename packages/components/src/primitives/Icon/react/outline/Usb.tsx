import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUsb = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 8H9V5h2zm4 0h-2V5h2z" />
    <Path
      fillRule="evenodd"
      d="M19 9h2v13H3V9h2V2h14zM5 20h14v-9H5zM7 9h10V4H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUsb;
