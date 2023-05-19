import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCode = (props: SvgProps) => (
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
      d="m10 20 4-16m4 4 4 4-4 4M6 16l-4-4 4-4"
    />
  </Svg>
);
export default SvgCode;
