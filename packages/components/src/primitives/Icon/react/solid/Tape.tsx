import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTape = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2m8 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
    <Path
      fillRule="evenodd"
      d="M23 20H1V4h22zM16 9a3 3 0 0 0-2.83 4h-2.34A3 3 0 1 0 8 15h8a3 3 0 1 0 0-6"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTape;
