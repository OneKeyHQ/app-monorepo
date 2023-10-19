import Svg, { SvgProps, Circle, Path } from 'react-native-svg';
const SvgKey = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Circle cx={7} cy={12} r={1.5} fill="currentColor" />
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2 12a5 5 0 0 0 9.014 2.982c.213-.287.537-.482.894-.482H14l2-1 2 1h2.02a1 1 0 0 0 .78-.375l1.2-1.5a1 1 0 0 0 0-1.25l-1.2-1.5a1 1 0 0 0-.78-.375h-8.112c-.357 0-.68-.195-.894-.482A5 5 0 0 0 2 12Z"
    />
  </Svg>
);
export default SvgKey;
