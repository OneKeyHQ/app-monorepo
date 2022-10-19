import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowLeft = (props: SvgProps) => (
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
      d="m10 19-7-7m0 0 7-7m-7 7h18"
    />
  </Svg>
);
export default SvgArrowLeft;
