import Svg, { SvgProps, Path, Circle } from 'react-native-svg';
const SvgControllerRoundRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M14.75 5.75a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0Zm0 12.5a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0ZM8.5 12A2.75 2.75 0 1 1 3 12a2.75 2.75 0 0 1 5.5 0Z"
    />
    <Circle
      cx={18.25}
      cy={12}
      r={2.75}
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
    />
  </Svg>
);
export default SvgControllerRoundRight;
