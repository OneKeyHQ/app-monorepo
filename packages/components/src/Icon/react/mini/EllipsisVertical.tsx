import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEllipsisVertical = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0 5.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm1.5 7a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0z" />
  </Svg>
);
export default SvgEllipsisVertical;
