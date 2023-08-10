import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagnifyingGlassCircle = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m15.75 15.75-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
    />
  </Svg>
);
export default SvgMagnifyingGlassCircle;
