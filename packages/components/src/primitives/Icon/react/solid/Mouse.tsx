import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMouse = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a7 7 0 0 1 7 7v6a7 7 0 1 1-14 0V9a7 7 0 0 1 7-7m-1 8h2V6h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMouse;
