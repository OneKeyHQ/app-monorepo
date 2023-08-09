import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagnifyingGlassPlus = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M9 6a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5A.75.75 0 0 1 9 6z" />
    <Path
      fillRule="evenodd"
      d="M2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9zm7-5.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagnifyingGlassPlus;
