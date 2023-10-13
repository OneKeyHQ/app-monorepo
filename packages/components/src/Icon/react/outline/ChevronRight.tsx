import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9 4 6.586 6.586a2 2 0 0 1 0 2.828L9 20"
    />
  </Svg>
);
export default SvgChevronRight;
