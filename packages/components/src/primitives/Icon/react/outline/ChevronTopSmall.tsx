import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronTopSmall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m8 14 3.293-3.293a1 1 0 0 1 1.414 0L16 14"
    />
  </Svg>
);
export default SvgChevronTopSmall;
