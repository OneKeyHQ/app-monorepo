import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEllipsisVertical = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm0 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEllipsisVertical;
