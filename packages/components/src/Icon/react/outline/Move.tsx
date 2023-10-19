import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMove = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9 5.5 2.293-2.293a1 1 0 0 1 1.414 0L15 5.5M5.5 9l-2.293 2.293a1 1 0 0 0 0 1.414L5.5 15m13-6 2.293 2.293a1 1 0 0 1 0 1.414L18.5 15M15 18.5l-2.293 2.293a1 1 0 0 1-1.414 0L9 18.5M12 4v8m0 0v8m0-8H4m8 0h8"
    />
  </Svg>
);
export default SvgMove;
