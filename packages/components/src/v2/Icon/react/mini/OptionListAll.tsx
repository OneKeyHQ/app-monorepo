import Svg, { Rect, Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOptionListAll = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Rect width={24} height={24} rx={12} />
    <Path
      fill="#8C8CA1"
      d="M11 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM17 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM17 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM11 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
    />
  </Svg>
);
export default SvgOptionListAll;
