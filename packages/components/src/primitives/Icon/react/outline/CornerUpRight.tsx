import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerUpRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 19v-6a4 4 0 0 0-4-4H4.75m2.75 4L4.207 9.707a1 1 0 0 1 0-1.414L7.5 5"
    />
  </Svg>
);
export default SvgCornerUpRight;
