import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMagnifyingGlassMinus = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    aria-hidden="true"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607zM13.5 10.5h-6"
    />
  </Svg>
);
export default SvgMagnifyingGlassMinus;
