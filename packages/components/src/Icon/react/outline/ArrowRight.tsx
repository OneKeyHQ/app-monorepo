import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowRight = (props: SvgProps) => (
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
      d="m14 5 7 7m0 0-7 7m7-7H3"
    />
  </Svg>
);
export default SvgArrowRight;
