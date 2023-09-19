import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagnifyingGlassCircle = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.5 9a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0z" />
    <Path
      fillRule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM9 5a4 4 0 1 0 2.248 7.309l1.472 1.471a.75.75 0 1 0 1.06-1.06l-1.471-1.472A4 4 0 0 0 9 5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagnifyingGlassCircle;
