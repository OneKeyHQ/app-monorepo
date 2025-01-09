import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRotateCounterclockwise = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.484 14.667A8 8 0 1 0 12.029 4C9.144 4 7.27 5.301 5.41 7.5M5 4v3.25c0 .414.336.75.75.75H9"
    />
  </Svg>
);
export default SvgRotateCounterclockwise;
