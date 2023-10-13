import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMouseUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m15 4-1.89-1.26a2 2 0 0 0-2.22 0L9 4m3 7v2m0 9a5 5 0 0 1-5-5v-5a5 5 0 1 1 10 0v5a5 5 0 0 1-5 5Z"
    />
  </Svg>
);
export default SvgMouseUp;
