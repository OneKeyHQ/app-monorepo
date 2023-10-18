import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m14 16 3.293-3.293a1 1 0 0 0 0-1.414L14 8m-7 8 3.293-3.293a1 1 0 0 0 0-1.414L7 8"
    />
  </Svg>
);
export default SvgChevronDoubleRight;
