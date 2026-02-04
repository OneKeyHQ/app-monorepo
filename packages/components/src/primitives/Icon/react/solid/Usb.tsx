import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUsb = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 6a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0zm3-1a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1" />
    <Path
      fillRule="evenodd"
      d="M6 2a1 1 0 0 0-1 1v6H4a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10a1 1 0 0 0-1-1h-1V3a1 1 0 0 0-1-1zm11 7V4H7v5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUsb;
