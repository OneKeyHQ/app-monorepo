import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowUp = (props: SvgProps) => (
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
      d="m5 10 7-7m0 0 7 7m-7-7v18"
    />
  </Svg>
);
export default SvgArrowUp;
