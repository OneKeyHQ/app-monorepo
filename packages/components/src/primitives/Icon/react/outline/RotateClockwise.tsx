import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRotateClockwise = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19.517 14.667A8 8 0 1 1 11.972 4c2.883 0 4.758 1.301 6.617 3.5M19 4v3.25a.75.75 0 0 1-.75.75H15"
    />
  </Svg>
);
export default SvgRotateClockwise;
