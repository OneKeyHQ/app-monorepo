import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTargetCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M12 7v2.5m2.5 2.5H17m-5 2.5V17m-5-5h2.5m2.5 9a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z"
    />
  </Svg>
);
export default SvgTargetCircle;
