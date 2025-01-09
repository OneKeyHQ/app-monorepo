import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m15 20-6.586-6.586a2 2 0 0 1 0-2.828L15 4"
    />
  </Svg>
);
export default SvgChevronLeft;
