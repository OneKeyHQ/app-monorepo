import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgServerStack = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.507 4.048A3 3 0 0 1 7.785 3h8.43a3 3 0 0 1 2.278 1.048l1.722 2.008A4.533 4.533 0 0 0 19.5 6h-15c-.243 0-.482.02-.715.056l1.722-2.008z" />
    <Path
      fillRule="evenodd"
      d="M1.5 10.5a3 3 0 0 1 3-3h15a3 3 0 1 1 0 6h-15a3 3 0 0 1-3-3zm15 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm2.25.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM4.5 15a3 3 0 1 0 0 6h15a3 3 0 1 0 0-6h-15zm11.25 3.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM19.5 18a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgServerStack;
