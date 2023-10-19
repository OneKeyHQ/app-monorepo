import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowExpandH = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m18.25 8 3.293 3.293a1 1 0 0 1 0 1.414L18.25 16M5.75 8l-3.293 3.293a1 1 0 0 0 0 1.414L5.75 16M3 12h18"
    />
  </Svg>
);
export default SvgArrowExpandH;
