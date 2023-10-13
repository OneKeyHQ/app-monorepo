import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m8 10.5 3.293-3.293a1 1 0 0 1 1.414 0L16 10.5m-8 7 3.293-3.293a1 1 0 0 1 1.414 0L16 17.5"
    />
  </Svg>
);
export default SvgChevronDoubleUp;
