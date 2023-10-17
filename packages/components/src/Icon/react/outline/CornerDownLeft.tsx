import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerDownLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 5v6a4 4 0 0 1-4 4H4.75m2.75-4-3.293 3.293a1 1 0 0 0 0 1.414L7.5 19"
    />
  </Svg>
);
export default SvgCornerDownLeft;
