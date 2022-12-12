import Svg, { SvgProps, Rect, Path } from 'react-native-svg';
const SvgOptionListAll = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Rect width={24} height={24} rx={12} />
    <Path
      d="M11 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM17 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM17 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM11 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
      fill="#8C8CA1"
    />
  </Svg>
);
export default SvgOptionListAll;
