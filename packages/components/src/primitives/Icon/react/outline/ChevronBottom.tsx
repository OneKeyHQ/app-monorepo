import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronBottom = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m20 9-6.586 6.586a2 2 0 0 1-2.828 0L4 9"
    />
  </Svg>
);
export default SvgChevronBottom;
