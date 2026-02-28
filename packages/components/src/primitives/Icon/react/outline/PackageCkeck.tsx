import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageCkeck = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v9h-2V5h-3v5H8V5H5v14h7v2H3V3zM10 8h4V5h-4z"
      clipRule="evenodd"
    />
    <Path d="M21.914 15.5 16.5 20.914l-3.164-3.164 1.414-1.414 1.75 1.75 4-4z" />
  </Svg>
);
export default SvgPackageCkeck;
