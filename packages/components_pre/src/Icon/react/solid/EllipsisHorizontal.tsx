import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEllipsisHorizontal = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEllipsisHorizontal;
