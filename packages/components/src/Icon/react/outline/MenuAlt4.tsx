import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMenuAlt4 = (props: SvgProps) => (
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
      d="M4 8h16M4 16h16"
    />
  </Svg>
);
export default SvgMenuAlt4;
