import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBackspace = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m12 14 2-2m0 0 2-2m-2 2-2-2m2 2 2 2M3 12l6.414 6.414a2 2 0 0 0 1.414.586H19a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-8.172a2 2 0 0 0-1.414.586L3 12z"
    />
  </Svg>
);
export default SvgBackspace;
