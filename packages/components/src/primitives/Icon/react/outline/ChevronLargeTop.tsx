import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronLargeTop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m3 14 8.029-4.46a2 2 0 0 1 1.942 0L21 14"
    />
  </Svg>
);
export default SvgChevronLargeTop;
