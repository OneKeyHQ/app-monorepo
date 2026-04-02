import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMouse = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 10h-2V6h2z" />
    <Path
      fillRule="evenodd"
      d="M12 2a7 7 0 0 1 7 7v6a7 7 0 1 1-14 0V9a7 7 0 0 1 7-7m0 2a5 5 0 0 0-5 5v6a5 5 0 0 0 10 0V9a5 5 0 0 0-5-5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMouse;
