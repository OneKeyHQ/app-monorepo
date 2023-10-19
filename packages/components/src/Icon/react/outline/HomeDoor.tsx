import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHomeDoor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M4 7.92a2 2 0 0 1 1.02-1.743l6-3.375a2 2 0 0 1 1.96 0l6 3.375A2 2 0 0 1 20 7.92V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.92Z"
    />
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </Svg>
);
export default SvgHomeDoor;
