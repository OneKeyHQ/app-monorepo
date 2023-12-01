import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRandomCrossover = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 18h1.172a2 2 0 0 0 1.414-.586l9.828-9.828A2 2 0 0 1 16.828 7H19M3 6h1.172a2 2 0 0 1 1.414.586L8 9m11 8h-2.172a2 2 0 0 1-1.414-.586L14 15m4-11 3 3-3 3m0 4 3 3-3 3"
    />
  </Svg>
);
export default SvgRandomCrossover;
