import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowSmUp = (props: SvgProps) => (
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
      d="m7 11 5-5m0 0 5 5m-5-5v12"
    />
  </Svg>
);
export default SvgArrowSmUp;
