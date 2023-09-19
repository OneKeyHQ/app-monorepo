import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagnifyingGlassMinus = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.75 8.25a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5z" />
    <Path
      fillRule="evenodd"
      d="M9 2a7 7 0 1 0 4.391 12.452l3.329 3.328a.75.75 0 1 0 1.06-1.06l-3.328-3.329A7 7 0 0 0 9 2zM3.5 9a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMagnifyingGlassMinus;
