import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBasket = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m8.5 4-2 5m0 0h11m-11 0H4m11.5-5 2 5m0 0H20m.785 1.179-1.487 8.179A2 2 0 0 1 17.331 20H6.669a2 2 0 0 1-1.968-1.642l-1.487-8.18A1 1 0 0 1 4.198 9h15.604a1 1 0 0 1 .983 1.179Z"
    />
  </Svg>
);
export default SvgBasket;
