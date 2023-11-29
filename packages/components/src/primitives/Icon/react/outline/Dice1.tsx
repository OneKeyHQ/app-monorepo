import Svg, { SvgProps, Rect, Circle } from 'react-native-svg';
const SvgDice1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Rect
      width={16}
      height={16}
      x={4}
      y={4}
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      rx={2}
    />
    <Circle cx={12} cy={12} r={1.5} fill="currentColor" />
  </Svg>
);
export default SvgDice1;
