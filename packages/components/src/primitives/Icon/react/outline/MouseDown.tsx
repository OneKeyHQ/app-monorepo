import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMouseDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m15 20-1.89 1.26a2 2 0 0 1-2.22 0L9 20m3-14v2m0 9a5 5 0 0 1-5-5V7a5 5 0 0 1 10 0v5a5 5 0 0 1-5 5Z"
    />
  </Svg>
);
export default SvgMouseDown;
