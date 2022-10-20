import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowSmRight = (props: SvgProps) => (
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
      d="m13 7 5 5m0 0-5 5m5-5H6"
    />
  </Svg>
);
export default SvgArrowSmRight;
