import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerDownRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 5v6a4 4 0 0 0 4 4h11.25m-2.75-4 3.293 3.293a1 1 0 0 1 0 1.414L16.5 19"
    />
  </Svg>
);
export default SvgCornerDownRight;
