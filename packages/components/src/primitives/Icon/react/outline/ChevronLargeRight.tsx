import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronLargeRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m10 21 4.46-8.029a2 2 0 0 0 0-1.942L10 3"
    />
  </Svg>
);
export default SvgChevronLargeRight;
