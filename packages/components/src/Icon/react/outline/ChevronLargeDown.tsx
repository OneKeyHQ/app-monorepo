import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronLargeDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m3 10 8.029 4.46a2 2 0 0 0 1.942 0L21 10"
    />
  </Svg>
);
export default SvgChevronLargeDown;
